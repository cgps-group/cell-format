"""CellGen 0.1 recursive-descent parser."""

from __future__ import annotations

import re

from .types import Attributes, Cell, CellSet, CellularElement, ChromosomeNode, EntityNode

_BARE_LABEL = re.compile(r"[A-Za-z0-9_.:-]")
_KEY_START = re.compile(r"[A-Za-z_]")
_KEY_CHAR = re.compile(r"[A-Za-z0-9_.:-]")


class ParseError(Exception):
    """A stable, positioned CellGen validation error."""

    def __init__(self, code: str, message: str, position: int, text: str,
                 *, found: str = "", expected: str = "") -> None:
        super().__init__(message)
        self.code = code
        self.position = position
        self.found = found
        self.expected = expected
        self.line = text.count("\n", 0, position) + 1
        line_start = text.rfind("\n", 0, position) + 1
        line_end = text.find("\n", position)
        if line_end < 0:
            line_end = len(text)
        self.column = position - line_start + 1
        self.context = text[line_start:line_end]

    def __str__(self) -> str:
        return f"{self.code}: {self.args[0]} (line {self.line}, column {self.column})"

    def as_dict(self) -> dict[str, str | int]:
        return {"code": self.code, "message": self.args[0], "position": self.position,
                "line": self.line, "column": self.column, "found": self.found,
                "expected": self.expected, "context": self.context}


class _Parser:
    def __init__(self, text: str) -> None:
        self.text = text
        self.pos = 0

    def _skip_ws(self) -> None:
        while self.pos < len(self.text) and self.text[self.pos].isspace():
            self.pos += 1

    def _peek(self) -> str:
        self._skip_ws()
        return self.text[self.pos] if self.pos < len(self.text) else ""

    def _take(self) -> str:
        self._skip_ws()
        if self.pos >= len(self.text):
            return ""
        char = self.text[self.pos]
        self.pos += 1
        return char

    def _error(self, code: str, message: str, *, expected: str = "",
               found: str | None = None, position: int | None = None) -> ParseError:
        at = self.pos if position is None else position
        actual = (self.text[at] if at < len(self.text) else "") if found is None else found
        return ParseError(code, message, at, self.text, found=actual, expected=expected)

    def _expect(self, char: str, code: str) -> None:
        self._skip_ws()
        at = self.pos
        got = self._take()
        if got != char:
            raise self._error(code, f"Expected '{char}' but found '{got or 'end of input'}'",
                              expected=char, found=got, position=at)

    def parse(self) -> CellSet:
        cells = [self._parse_cell()]
        while self._peek() == ";":
            self._take()
            if not self._peek():
                raise self._error("TRAILING_SEPARATOR", "A semicolon must be followed by another cell", expected="(")
            cells.append(self._parse_cell())
        if self._peek():
            token = self._peek()
            raise self._error("UNEXPECTED_TOKEN", f"Unexpected character '{token}' after the cell", found=token)
        return CellSet(cells=cells)

    def _parse_cell(self) -> Cell:
        replicons = [self._parse_replicon()]
        while True:
            token = self._peek()
            if token == ",":
                self._take()
                if self._peek() not in ("(", "{"):
                    raise self._error("TRAILING_SEPARATOR", "A comma must be followed by a chromosome or entity", expected="( or {")
                replicons.append(self._parse_replicon())
            elif token in ("", ";"):
                break
            elif token in ("(", "{"):
                raise self._error("MISSING_SEPARATOR", "Expected ',' between cellular elements", expected=",")
            else:
                break
        return Cell(replicons=replicons)

    def _parse_replicon(self) -> CellularElement:
        token = self._peek()
        if token == "(":
            return self._parse_chromosome()
        if token == "{":
            return self._parse_entity()
        raise self._error("EXPECTED_ELEMENT",
                          f"Expected '(' for a chromosome or '{{' for an entity but found '{token or 'end of input'}'",
                          expected="( or {")

    def _parse_chromosome(self) -> ChromosomeNode:
        self._expect("(", "EXPECTED_CHROMOSOME")
        children = self._parse_children(")")
        self._expect(")", "UNCLOSED_CHROMOSOME")
        return ChromosomeNode(label=self._parse_label(), children=children,
                              attributes=self._parse_attributes())

    def _parse_entity(self) -> EntityNode:
        self._expect("{", "EXPECTED_ENTITY")
        children = self._parse_children("}")
        self._expect("}", "UNCLOSED_ENTITY")
        return EntityNode(label=self._parse_label(), children=children,
                          attributes=self._parse_attributes())

    def _parse_children(self, closer: str) -> list[EntityNode]:
        children: list[EntityNode] = []
        if self._peek() == closer:
            return children
        if self._peek() == "(":
            raise self._error("NESTED_CHROMOSOME", "Chromosomes cannot be nested", expected="{")
        if not self._peek():
            code = "UNCLOSED_CHROMOSOME" if closer == ")" else "UNCLOSED_ENTITY"
            raise self._error(code, f"Unclosed container; expected '{closer}'", expected=closer)
        children.append(self._parse_entity())
        while True:
            token = self._peek()
            if token == closer:
                return children
            if token == ",":
                self._take()
                if self._peek() == closer:
                    raise self._error("TRAILING_SEPARATOR", f"A comma cannot appear immediately before '{closer}'", expected="{")
                if self._peek() == "(":
                    raise self._error("NESTED_CHROMOSOME", "Chromosomes cannot be nested", expected="{")
                children.append(self._parse_entity())
                continue
            if not token:
                code = "UNCLOSED_CHROMOSOME" if closer == ")" else "UNCLOSED_ENTITY"
                raise self._error(code, f"Unclosed container; expected '{closer}'", expected=closer)
            if token == "{":
                raise self._error("MISSING_SEPARATOR", "Expected ',' between contained entities", expected=",")
            raise self._error("UNEXPECTED_TOKEN", f"Expected ',' or '{closer}' but found '{token}'", expected=f", or {closer}")

    def _parse_label(self) -> str:
        self._skip_ws()
        if self.pos < len(self.text) and self.text[self.pos] == '"':
            return self._parse_quoted("label")
        start = self.pos
        while self.pos < len(self.text) and _BARE_LABEL.fullmatch(self.text[self.pos]):
            self.pos += 1
        return self.text[start:self.pos]

    def _parse_attributes(self) -> Attributes:
        if self._peek() != "[":
            return {}
        self._take()
        if self._peek() == "]":
            raise self._error("EMPTY_ATTRIBUTES", "An attribute block must contain a key-value pair", expected="attribute key")
        attrs: Attributes = {}
        while True:
            key = self._parse_key()
            if key in attrs:
                raise self._error("DUPLICATE_ATTRIBUTE", f"Attribute '{key}' is repeated", found=key)
            self._expect("=", "MISSING_EQUALS")
            if self._peek() != '"':
                raise self._error("UNQUOTED_VALUE", "Attribute values must be enclosed in double quotes", expected='"')
            attrs[key] = self._parse_quoted("attribute value")
            token = self._peek()
            if token == "]":
                self._take()
                return attrs
            if token != ",":
                if not token:
                    raise self._error("UNCLOSED_ATTRIBUTES", "Unclosed attribute block; expected ']'", expected="]")
                raise self._error("MISSING_SEPARATOR", "Expected ',' between attributes", expected=",")
            self._take()
            if self._peek() == "]":
                raise self._error("TRAILING_SEPARATOR", "A comma cannot appear immediately before ']'", expected="attribute key")

    def _parse_key(self) -> str:
        self._skip_ws()
        start = self.pos
        if self.pos >= len(self.text) or not _KEY_START.fullmatch(self.text[self.pos]):
            raise self._error("INVALID_ATTRIBUTE_KEY", "Attribute keys must start with a letter or underscore", expected="attribute key")
        self.pos += 1
        while self.pos < len(self.text) and _KEY_CHAR.fullmatch(self.text[self.pos]):
            self.pos += 1
        return self.text[start:self.pos]

    def _parse_quoted(self, role: str) -> str:
        self._expect('"', "EXPECTED_QUOTE")
        chars: list[str] = []
        escapes = {'"': '"', "\\": "\\", "n": "\n", "r": "\r", "t": "\t"}
        while self.pos < len(self.text):
            char = self.text[self.pos]
            self.pos += 1
            if char == '"':
                return "".join(chars)
            if char == "\\":
                if self.pos >= len(self.text):
                    raise self._error("INVALID_ESCAPE", f"Unfinished escape in {role}", expected="escaped character")
                escaped = self.text[self.pos]
                self.pos += 1
                if escaped not in escapes:
                    raise self._error("INVALID_ESCAPE", f"Unsupported escape '\\{escaped}' in {role}", found=escaped, position=self.pos - 1)
                chars.append(escapes[escaped])
            else:
                chars.append(char)
        raise self._error("UNCLOSED_QUOTE", f"Unclosed {role}; expected a closing double quote", expected='"')


def parse(text: str) -> CellSet:
    if not text.strip():
        raise ParseError("EMPTY_INPUT", "Input is empty", 0, text)
    return _Parser(text).parse()


def validate(text: str) -> list[str]:
    try:
        parse(text)
        return []
    except ParseError as error:
        caret = " " * max(0, error.column - 1) + "^"
        return [f"{error}\n{error.context}\n{caret}"]


def is_valid(text: str) -> bool:
    return not validate(text)
