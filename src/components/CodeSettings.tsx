import { Settings2 } from 'lucide-react';
import { DEFAULT_CODE_SETTINGS, setCodeSettings, useCodeSettings, type FontSize } from '../settings/codeSettings.ts';
import { Button } from './arc/button/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from './arc/popover/popover.tsx';
import SegmentedControl from './arc/segmented-control/segmented-control.tsx';
import { Switch } from './arc/switch/switch.tsx';

const FONT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const INDENTS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
];

/** The code settings, from any code block or editor. They apply everywhere and are remembered in this browser. */
export function CodeSettings() {
  const settings = useCodeSettings();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="icon-only code-settings-trigger" aria-label="Code settings" title="Code settings">
          <Settings2 size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="code-settings" aria-label="Code settings">
        <fieldset>
          <legend>Display</legend>
          <Switch label="Wrap long lines" checked={settings.wrap} onCheckedChange={(wrap) => setCodeSettings({ wrap })} />
          <Switch label="Line numbers" checked={settings.lineNumbers} onCheckedChange={(lineNumbers) => setCodeSettings({ lineNumbers })} />
          <Switch label="Syntax highlighting" checked={settings.highlight} onCheckedChange={(highlight) => setCodeSettings({ highlight })} />
          <div className="setting">
            {/* Visible caption; the control carries the same name for screen readers. */}
            <span aria-hidden="true">Font size</span>
            <SegmentedControl label="Font size" options={FONT_SIZES} value={settings.fontSize} onValueChange={(value) => setCodeSettings({ fontSize: value as FontSize })} />
          </div>
        </fieldset>
        <fieldset>
          <legend>Editing</legend>
          <Switch label="Highlight current line" checked={settings.activeLine} onCheckedChange={(activeLine) => setCodeSettings({ activeLine })} />
          <Switch label="Close brackets automatically" checked={settings.closeBrackets} onCheckedChange={(closeBrackets) => setCodeSettings({ closeBrackets })} />
          <div className="setting">
            <span aria-hidden="true">Indent</span>
            <SegmentedControl label="Indent" options={INDENTS} value={String(settings.tabSize)} onValueChange={(value) => setCodeSettings({ tabSize: value === '2' ? 2 : 4 })} />
          </div>
        </fieldset>
        <Button size="sm" variant="ghost" onClick={() => setCodeSettings(DEFAULT_CODE_SETTINGS)}>
          Reset to defaults
        </Button>
      </PopoverContent>
    </Popover>
  );
}
