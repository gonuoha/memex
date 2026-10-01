"use client";

import { useEditorPreferences } from "@/components/code-editor/editor-preferences-context";
import { PageSection } from "@/components/layout/page-container";
import { PreferenceField } from "@/components/shared/preference-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  EDITOR_FONT_SIZES,
  EDITOR_TAB_SIZES,
  EDITOR_THEME_LABELS,
  EDITOR_THEMES,
  type EditorFontSize,
  type EditorPreferences,
  type EditorTabSize,
  type EditorTheme,
} from "@/lib/editor-preferences";

export function EditorPreferencesCard() {
  const { preferences, updatePreferences, isSaving } = useEditorPreferences();

  const updateField = <K extends keyof EditorPreferences>(
    key: K,
    value: EditorPreferences[K],
  ) => {
    updatePreferences({ ...preferences, [key]: value });
  };

  return (
    <PageSection
      title="Editor Preferences"
      description={
        <>
          Customize how code appears in snippet and command editors.
          {isSaving ? " Saving..." : ""}
        </>
      }
      contentClassName="space-y-6"
    >
      <PreferenceField label="Font size">
        <Select
          value={String(preferences.fontSize)}
          onValueChange={(value) =>
            updateField("fontSize", Number(value) as EditorFontSize)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>{preferences.fontSize}px</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EDITOR_FONT_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PreferenceField>

      <PreferenceField label="Tab size">
        <Select
          value={String(preferences.tabSize)}
          onValueChange={(value) =>
            updateField("tabSize", Number(value) as EditorTabSize)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue>{preferences.tabSize} spaces</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EDITOR_TAB_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} spaces
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PreferenceField>

      <PreferenceField label="Theme">
        <Select
          value={preferences.theme}
          onValueChange={(value) => updateField("theme", value as EditorTheme)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{EDITOR_THEME_LABELS[preferences.theme]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EDITOR_THEMES.map((theme) => (
              <SelectItem key={theme} value={theme}>
                {EDITOR_THEME_LABELS[theme]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PreferenceField>

      <PreferenceField
        label="Word wrap"
        description="Wrap long lines instead of horizontal scrolling."
      >
        <Switch
          checked={preferences.wordWrap}
          onCheckedChange={(checked) => updateField("wordWrap", checked)}
        />
      </PreferenceField>

      <PreferenceField
        label="Minimap"
        description="Show a code overview on the right side of the editor."
      >
        <Switch
          checked={preferences.minimap}
          onCheckedChange={(checked) => updateField("minimap", checked)}
        />
      </PreferenceField>
    </PageSection>
  );
}
