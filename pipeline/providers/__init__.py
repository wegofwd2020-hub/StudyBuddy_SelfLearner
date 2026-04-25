"""
pipeline/providers

LLM provider abstraction for StudyBuddy Q.

NOTE: StudyBuddy Q is single-provider (Anthropic) by design — the user pays
Anthropic directly under BYOK (see ADR-001). The OnDemand multi-provider
registry is intentionally NOT vendored.
"""

from pipeline.providers.anthropic import AnthropicProvider
from pipeline.providers.base import LLMProvider

__all__ = ["AnthropicProvider", "LLMProvider"]
