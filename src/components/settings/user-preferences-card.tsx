"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateUserPreferences } from "@/actions/settings";
import { PageSection } from "@/components/layout/page-container";
import { PreferenceField } from "@/components/shared/preference-field";
import { useAppearance } from "@/components/theme/appearance-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  APPEARANCE_LABELS,
  APPEARANCES,
  TYPE_COLOR_POSITION_LABELS,
  TYPE_COLOR_POSITIONS,
  type Appearance,
  type TypeColorPosition,
  type UserPreferences,
} from "@/lib/user-preferences";

type UserPreferencesCardProps = {
  initialPreferences: UserPreferences;
};

export function UserPreferencesCard({
  initialPreferences,
}: UserPreferencesCardProps) {
  const [preferences, setPreferences] =
    useState<UserPreferences>(initialPreferences);
  const [isSaving, startSaving] = useTransition();
  const { setAppearance } = useAppearance();

  const updateField = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);

    startSaving(async () => {
      const result = await updateUserPreferences(next);

      if (!result.success) {
        setPreferences(previous);
        toast.error(result.error);
        return;
      }

      setPreferences(result.data);
      setAppearance(result.data.appearance);
      toast.success("User preferences saved");
    });
  };

  return (
    <PageSection
      title="User Preferences"
      description={
        <>
          Customize your Memex experience.
          {isSaving ? " Saving..." : ""}
        </>
      }
      contentClassName="space-y-6"
    >
        <PreferenceField
          label="Theme"
          description="Choose a color theme or match your system setting."
        >
          <Select
            value={preferences.appearance}
            onValueChange={(value) =>
              updateField("appearance", value as Appearance)
            }
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue>{APPEARANCE_LABELS[preferences.appearance]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {APPEARANCES.map((option) => (
                <SelectItem key={option} value={option}>
                  {APPEARANCE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceField>

        <PreferenceField
          label="Overview section"
          description="Show item type stats at the top of the dashboard."
        >
          <Switch
            checked={preferences.showOverview}
            onCheckedChange={(checked) => updateField("showOverview", checked)}
          />
        </PreferenceField>

        <PreferenceField
          label="Link favicons"
          description="Show site icons on link cards. Icons are fetched from Google's favicon service using only the link's hostname."
        >
          <Switch
            checked={preferences.showLinkFavicons}
            onCheckedChange={(checked) =>
              updateField("showLinkFavicons", checked)
            }
          />
        </PreferenceField>

        <PreferenceField
          label="Type color position"
          description="Choose where the item type color appears on cards."
        >
          <Select
            value={preferences.typeColorPosition}
            onValueChange={(value) =>
              updateField("typeColorPosition", value as TypeColorPosition)
            }
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue>
                {TYPE_COLOR_POSITION_LABELS[preferences.typeColorPosition]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPE_COLOR_POSITIONS.map((position) => (
                <SelectItem key={position} value={position}>
                  {TYPE_COLOR_POSITION_LABELS[position]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceField>
    </PageSection>
  );
}
