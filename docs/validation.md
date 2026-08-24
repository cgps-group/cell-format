# Validation errors

Python and TypeScript return the same diagnostic fields: `code`, `message`, zero-based `position`, one-based `line` and `column`, `found`, `expected`, and the affected source line as `context`.

```text
UNCLOSED_ENTITY: Unclosed container; expected '}' (line 1, column 22)
{{}blaKPC-2}Tn4401
                     ^
```

Stable codes include `EMPTY_INPUT`, `EXPECTED_ELEMENT`, `UNCLOSED_CHROMOSOME`, `UNCLOSED_ENTITY`, `UNCLOSED_ATTRIBUTES`, `UNCLOSED_QUOTE`, `MISSING_SEPARATOR`, `TRAILING_SEPARATOR`, `NESTED_CHROMOSOME`, `MISSING_EQUALS`, `UNQUOTED_VALUE`, `INVALID_ESCAPE`, `EMPTY_ATTRIBUTES`, and `DUPLICATE_ATTRIBUTE`.

Invalid user input is returned as a validation diagnostic. Unexpected internal failures use `INTERNAL_ERROR` in TypeScript or raise the underlying Python exception when they are not syntax errors.

