import type { FC } from "react";
import { PrismAsyncLight as SyntaxHighlighterPrism } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";

// Register languages you want to support
SyntaxHighlighterPrism.registerLanguage("js", tsx);
SyntaxHighlighterPrism.registerLanguage("jsx", tsx);
SyntaxHighlighterPrism.registerLanguage("ts", tsx);
SyntaxHighlighterPrism.registerLanguage("tsx", tsx);
SyntaxHighlighterPrism.registerLanguage("python", python);

interface SyntaxHighlighterProps {
  children: string;
  language: string;
  className?: string;
}

export const SyntaxHighlighter: FC<SyntaxHighlighterProps> = ({
  children,
  language,
  className,
}) => (
  <SyntaxHighlighterPrism
    className={className}
    customStyle={{
      margin: 0,
      width: "100%",
      background: "transparent",
      padding: "1.5rem 1rem",
    }}
    language={language}
    style={coldarkDark}
  >
    {children}
  </SyntaxHighlighterPrism>
);
