# Format specification

## Grammar

```ebnf
Document        = Cell , { ";" , Cell } ;
Cell            = CellularElement , { "," , CellularElement } ;
CellularElement = Chromosome | Entity ;
Chromosome      = "(" , [ EntitySet ] , ")" , Annotation ;
Entity          = "{" , [ EntitySet ] , "}" , Annotation ;
EntitySet       = Entity , { "," , Entity } ;
Annotation      = [ Label ] , [ Attributes ] ;
Attributes      = "[" , KeyValue , { "," , KeyValue } , "]" ;
KeyValue        = Key , "=" , Quoted ;
Label           = BareLabel | Quoted ;
```

`BareLabel` and attribute keys use letters, digits, `_`, `.`, `:`, and `-`; keys must start with a letter or underscore. Labels containing spaces or reserved characters must be double-quoted.

Quoted labels and values support `\\"`, `\\\\`, `\\n`, `\\r`, and `\\t` escapes.

## Rules

- `( )` denotes a chromosome, and only a chromosome.
- `{ }` denotes any other biological entity. Curly braces do not imply mobility.
- Chromosomes cannot be nested.
- Sibling elements and attributes require commas.
- A semicolon separates cells.
- Attribute keys must be unique on an element.
- Trailing separators and empty attribute blocks are invalid.

Parsers accept insignificant whitespace and produce a canonical serialisation with consistent separators and escaping.

