# Context Optimization & Sandboxing Rules (context-mode)

To preserve context window capacity and maintain maximum reasoning quality:

1. **No Raw Data Flooding:**
   - Never dump entire logs, multi-page web fetches, or multi-hundred-line files into the conversation.
   - For file exploration, summaries, or counting metrics, use `ctx_execute_file` or `ctx_execute` to return only the derived answer.

2. **Native File Tools Boundary:**
   - Native `view_file` is reserved for inspecting small, precise ranges of code immediately prior to making an edit.
   - Native `replace_file_content` remains the standard for applying surgical code changes.

3. **Session & Knowledge Preservation:**
   - Use `ctx_index` and `ctx_search` to store and retrieve reference material across long tasks.
