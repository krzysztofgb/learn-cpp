import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { FONT_SIZE_PX, useCodeSettings, type CodeSettings } from '../settings/codeSettings.ts';

// Colors come from CSS tokens, so the editor follows the app's light and dark themes.
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: 'var(--syntax-keyword)' },
  { tag: [tags.typeName, tags.standard(tags.typeName), tags.namespace], color: 'var(--syntax-type)' },
  { tag: [tags.string, tags.special(tags.string), tags.character], color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syntax-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta], color: 'var(--syntax-meta)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--syntax-function)' },
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--foreground)' },
  // On the scroller, so the line-number gutter shares the code's face.
  '.cm-scroller': { fontFamily: 'var(--font-mono)' },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--text-muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--code-active)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--selection)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  // Vim: the block cursor and the mode line.
  '.cm-fat-cursor': { background: 'var(--accent)', color: 'var(--accent-foreground)' },
  '&:not(.cm-focused) .cm-fat-cursor': { background: 'none', outline: '1px solid var(--accent)' },
  '.cm-vim-panel': { padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--surface)' },
});

/** CodeMirror's basicSetup, minus the parts the code settings switch on and off. */
const base: Extension[] = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap]),
];

/** Vim bindings load only for someone who picks them; the editor reconfigures once they arrive. */
let vimBindings: Promise<Extension> | undefined;
const loadVim = () => (vimBindings ??= import('@replit/codemirror-vim').then(({ vim }) => vim({ status: true })));

/** Placed first, so Vim's keys win over the default keymap. */
const keysPart = new Compartment();

/** One compartment per setting, so a change reconfigures open editors in place. */
const parts = {
  lineNumbers: new Compartment(),
  wrap: new Compartment(),
  highlight: new Compartment(),
  activeLine: new Compartment(),
  closeBrackets: new Compartment(),
  indent: new Compartment(),
  fontSize: new Compartment(),
};

function configure(settings: CodeSettings): Record<keyof typeof parts, Extension> {
  return {
    lineNumbers: settings.lineNumbers ? [lineNumbers(), foldGutter()] : [],
    wrap: settings.wrap ? EditorView.lineWrapping : [],
    highlight: settings.highlight ? syntaxHighlighting(highlight) : [],
    activeLine: settings.activeLine ? [highlightActiveLine(), highlightActiveLineGutter()] : [],
    closeBrackets: settings.closeBrackets ? closeBrackets() : [],
    indent: [EditorState.tabSize.of(settings.tabSize), indentUnit.of(' '.repeat(settings.tabSize))],
    fontSize: EditorView.theme({ '&': { fontSize: `${FONT_SIZE_PX[settings.fontSize]}px` } }),
  };
}

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** Ctrl/Cmd-Enter. */
  onRun?: () => void;
  readOnly?: boolean;
  label: string;
}

export function CodeEditor({ value, onChange, onRun, readOnly = false, label }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const settings = useCodeSettings();
  const callbacks = useRef({ onChange, onRun, settings });
  useLayoutEffect(() => {
    callbacks.current = { onChange, onRun, settings };
  });

  useEffect(() => {
    const configured = configure(callbacks.current.settings);
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          keysPart.of([]),
          keymap.of([{ key: 'Mod-Enter', run: () => (callbacks.current.onRun?.(), true) }]),
          base,
          cpp(),
          theme,
          ...Object.entries(parts).map(([name, part]) => part.of(configured[name as keyof typeof parts])),
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor owns its document after mount; `value` and settings changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, label]);

  useEffect(() => {
    const configured = configure(settings);
    view.current?.dispatch({ effects: Object.entries(parts).map(([name, part]) => part.reconfigure(configured[name as keyof typeof parts])) });
  }, [settings]);

  useEffect(() => {
    if (settings.keys !== 'vim') {
      view.current?.dispatch({ effects: keysPart.reconfigure([]) });
      return;
    }
    let current = true;
    void loadVim().then((bindings) => {
      if (current) view.current?.dispatch({ effects: keysPart.reconfigure(bindings) });
    });
    return () => {
      current = false;
    };
  }, [settings.keys]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div className="code-editor" ref={host} />;
}
