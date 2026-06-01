"""
pipeline/providers/registry.py

Provider metadata + a BYOK factory. Logical *roles* (authoring / toc / fast-draft)
map to a (provider, model) pair so model ids live in one place with one update
policy — application code never hardcodes a model string.

⚠ Model ids marked UNVERIFIED below are placeholders from docs/llm-providers.md
and MUST be validated against each vendor before use (ADR-005 open question).
Capabilities are deliberately conservative; widen them only once confirmed.
"""

from __future__ import annotations

from dataclasses import dataclass

from pipeline.providers.contract import LLM_CONTRACT_VERSION, Capabilities, Provider
from pipeline.providers.errors import LLMConfigurationError


@dataclass(frozen=True)
class ProviderSpec:
    provider_id: str
    openai_compatible: bool
    default_model: str
    capabilities: Capabilities
    base_url: str | None = None  # None for providers with their own SDK (Anthropic)
    managed_env_key: str = ""  # env var for the MANAGED key (unused on the BYOK path)
    model_verified: bool = False
    # Version of OUR integration for this provider (request shaping, JSON mode,
    # prompt shims). Bump when we change HOW we call the vendor — independent of
    # the model id and the contract version. Recorded in provenance().
    integration_version: int = 1


PROVIDER_REGISTRY: dict[str, ProviderSpec] = {
    "anthropic": ProviderSpec(
        provider_id="anthropic",
        openai_compatible=False,
        default_model="claude-sonnet-4-6",
        # JSON delivered via tool-use (see anthropic_native.py).
        capabilities=Capabilities(json_object=True, json_schema=True, tools=True, max_context=200_000),
        managed_env_key="ANTHROPIC_API_KEY",
        model_verified=True,
    ),
    "openai": ProviderSpec(
        provider_id="openai",
        openai_compatible=True,
        base_url="https://api.openai.com/v1",
        default_model="gpt-4o-mini",  # UNVERIFIED
        capabilities=Capabilities(json_object=True, json_schema=True, tools=True, max_context=128_000),
        managed_env_key="OPENAI_API_KEY",
    ),
    "deepseek": ProviderSpec(
        provider_id="deepseek",
        openai_compatible=True,
        base_url="https://api.deepseek.com/v1",
        default_model="deepseek-chat",  # UNVERIFIED
        capabilities=Capabilities(json_object=True, tools=True, max_context=64_000),
        managed_env_key="DEEPSEEK_API_KEY",
    ),
    "qwen": ProviderSpec(
        provider_id="qwen",
        openai_compatible=True,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",  # UNVERIFIED
        default_model="qwen-max",  # UNVERIFIED
        capabilities=Capabilities(json_object=True, max_context=32_000),
        managed_env_key="QWEN_API_KEY",
    ),
    "gemma": ProviderSpec(
        provider_id="gemma",
        openai_compatible=True,
        base_url="",  # UNVERIFIED — depends on hosting (e.g. OpenRouter / self-host)
        default_model="gemma-2-27b-it",  # UNVERIFIED
        capabilities=Capabilities(json_object=False, max_context=8_000),
        managed_env_key="GEMMA_API_KEY",
    ),
}

# Logical role → (provider_id, model). One place to bump versions / route by cost.
ROLE_DEFAULTS: dict[str, tuple[str, str]] = {
    "authoring": ("anthropic", "claude-sonnet-4-6"),  # long, schema-heavy lessons
    "toc": ("anthropic", "claude-sonnet-4-6"),  # structuring
    "fast-draft": ("openai", "gpt-4o-mini"),  # cheap preview tier (UNVERIFIED model)
}


def available_providers() -> list[str]:
    return list(PROVIDER_REGISTRY)


def validate_selection(provider_id: str, model: str | None = None) -> tuple[str, str]:
    """Resolve + validate a user/caller LLM choice (the seam the future request
    param + mobile selector call). Returns (provider_id, model). The provider
    must be known; the model string is accepted as-is (we don't hold a vendor
    catalogue) and defaults to the spec default. Raises LLMConfigurationError
    for an unknown provider."""
    spec = PROVIDER_REGISTRY.get(provider_id)
    if spec is None:
        raise LLMConfigurationError(f"unknown provider {provider_id!r}")
    return provider_id, (model or spec.default_model)


def provenance(provider_id: str, model: str | None = None) -> dict:
    """A stampable record of WHICH LLM + versions produced a generation — meant
    to be stored on each generated unit and on a book's pinned params, so we can
    enforce per-book model pinning and detect content made with an outdated
    integration/model (and offer to regenerate). See multi-provider-directions §6."""
    pid, chosen_model = validate_selection(provider_id, model)
    spec = PROVIDER_REGISTRY[pid]
    return {
        "provider": pid,
        "model": chosen_model,
        "model_verified": spec.model_verified,
        "integration_version": spec.integration_version,
        "contract_version": LLM_CONTRACT_VERSION,
    }


def resolve_role(role: str) -> tuple[str, str]:
    """(provider_id, model) for a logical role."""
    try:
        return ROLE_DEFAULTS[role]
    except KeyError:
        raise LLMConfigurationError(f"unknown role {role!r}") from None


def build_provider(
    provider_id: str,
    *,
    api_key: str,
    model: str | None = None,
    http_client=None,
) -> Provider:
    """Construct a BYOK provider from the registry. `model` overrides the spec
    default. `http_client` (httpx.Client) is for OpenAI-compatible providers,
    chiefly to inject a MockTransport in tests."""
    spec = PROVIDER_REGISTRY.get(provider_id)
    if spec is None:
        raise LLMConfigurationError(f"unknown provider {provider_id!r}")
    chosen_model = model or spec.default_model

    if spec.openai_compatible:
        from pipeline.providers.openai_compatible import OpenAICompatibleProvider

        kwargs = {
            "api_key": api_key,
            "base_url": spec.base_url or "",
            "model": chosen_model,
            "provider_id": spec.provider_id,
            "capabilities": spec.capabilities,
        }
        if http_client is not None:
            kwargs["client"] = http_client
        return OpenAICompatibleProvider(**kwargs)

    if spec.provider_id == "anthropic":
        # Native provider: uses tool-use for reliable JSON. The legacy-wrapping
        # AnthropicAdapter remains available for the eventual backend rewire.
        from pipeline.providers.anthropic_native import AnthropicNativeProvider

        return AnthropicNativeProvider(api_key=api_key, model=chosen_model)

    raise LLMConfigurationError(f"no constructor wired for provider {provider_id!r}")
