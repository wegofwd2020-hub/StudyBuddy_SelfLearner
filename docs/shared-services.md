# Shared-services architecture

The platform-services architecture for the wegofwd product family is maintained in
the shared **`wegofwd-llm`** repo — its **canonical home** (every product consumes
that package in-process; see ADR-012). The products link here rather than each
keeping a copy.

📐 **[shared_service.drawio →](https://github.com/wegofwd2020-hub/wegofwd-llm/blob/main/docs/shared_service.drawio)**

Open / edit with [draw.io](https://app.diagrams.net/) or the VS Code Draw.io
extension. This product (**StudyBuddy_SelfLearner** / Mentible) is one of the
consumers the diagram depicts, alongside **kathai-chithiram** and **pramana**.
