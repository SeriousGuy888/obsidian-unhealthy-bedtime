import {
	AbstractInputSuggest,
	App,
	PluginSettingTab,
	Setting,
	TextComponent,
	ToggleComponent,
} from "obsidian";
import UnhealthyBedtimePlugin from "./main";

export interface UnhealthyBedtimeSettings {
	minutesAfterMidnightCutoff: number;
	confirmBeforeCreatingNonexistentDailyNote: boolean;
}

export const DEFAULT_SETTINGS: Partial<UnhealthyBedtimeSettings> = {
	minutesAfterMidnightCutoff: 4 * 60,
	confirmBeforeCreatingNonexistentDailyNote: true,
};

export class UnhealthyBedtimeSettingTab extends PluginSettingTab {
	plugin: UnhealthyBedtimePlugin;

	constructor(app: App, plugin: UnhealthyBedtimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const title = document.createElement("h1");
		title.setText("Unhealthy Bedtime · Settings"); // eslint-disable-line obsidianmd/ui/sentence-case
		containerEl.appendChild(title);

		new Setting(containerEl)
			.setName("Cutoff time after midnight for the previous day")
			.setDesc(
				// ""
				`All times up to the time you specify here are considered the previous day for the purposes of this plugin.

				For example, if you specify \`04:00\`, then if you try to go to "today's" daily note on 2026-01-02 at 03:45, then the plugin will actually open the \`2026-01-01\` daily note instead.

				You should specify a time between 00:00 and 23:59.
				`
			)
			.addText((text: TextComponent) => {
				text.setPlaceholder("04:00")
					.setValue(
						minutesToSexagesimal(
							this.plugin.settings.minutesAfterMidnightCutoff
						)
					)
					.onChange(async (value: string) => {});

				new SexagesimalTimeSuggest(this.plugin.app, text.inputEl); // nosonar

				// Wait for the user to deselect before writing their changes and converting to standard format.
				this.plugin.registerDomEvent(
					text.inputEl,
					"focusout",
					async (_event: FocusEvent) => {
						const minutes = sexagesimalToMinutes(
							text.inputEl.value
						);
						this.plugin.settings.minutesAfterMidnightCutoff =
							minutes;
						await this.plugin.saveSettings();
						text.setValue(minutesToSexagesimal(minutes));
					}
				);
			});

		new Setting(this.containerEl)
			.setName("Ask before creating daily note")
			.setDesc(
				"If when you try to open today's daily note, the note doesn't exist yet, " +
					"should the plugin ask before creating it or just create it without asking?"
			)
			.addToggle((toggle: ToggleComponent) => {
				toggle
					.setValue(
						this.plugin.settings
							.confirmBeforeCreatingNonexistentDailyNote
					)
					.onChange((value) => {
						this.plugin.settings.confirmBeforeCreatingNonexistentDailyNote =
							value;
						this.plugin.saveSettings();
					});
			});
	}
}

type SexagesimalTimeSuggestion = {
	content: string;
	annotation: string;
};

class SexagesimalTimeSuggest extends AbstractInputSuggest<SexagesimalTimeSuggestion> {
	constructor(readonly app: App, private readonly inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	protected getSuggestions(
		query: string
	): SexagesimalTimeSuggestion[] | Promise<SexagesimalTimeSuggestion[]> {
		const suggestions = [];

		// One suggestion is to simply normalise whatever the user typed.
		// This mainly serves to show the user what the plugin is interpreting their input as.
		suggestions.push({
			content: minutesToSexagesimal(sexagesimalToMinutes(query)),
			annotation: "",
		});

		// Another suggestion is to interpret the user's input as just a number of minutes.
		// (just in case the user wants to input it this way)
		if (!query.contains(":")) {
			const queryAsInt = clampToValidMinutes(Number.parseInt(query));
			const suggestion: SexagesimalTimeSuggestion = {
				content: minutesToSexagesimal(queryAsInt),
				annotation: "= " + queryAsInt + " minutes",
			};
			if (queryAsInt && suggestion.content !== suggestions[0]?.content) {
				suggestions.push(suggestion);
			}
		}

		return suggestions;
	}

	renderSuggestion(value: SexagesimalTimeSuggestion, el: HTMLElement): void {
		el.setText(value.content + " " + value.annotation);
	}

	selectSuggestion(
		value: SexagesimalTimeSuggestion,
		evt: MouseEvent | KeyboardEvent
	): void {
		this.inputEl.value = value.content;
	}
}

/**
 * Given a length of time in minutes, return that same length of time but notated as "[hours]:[minutes]".
 * @param minutes A nonnegative integer number of minutes.
 * @example minutesToSexagesimal(125) // "2:05"
 */
function minutesToSexagesimal(minutes: number): string {
	const numHours = Math.floor(minutes / 60);
	const numRemainingMinutes = minutes % 60;
	return (
		numHours.toString().padStart(2, "0") +
		":" +
		numRemainingMinutes.toString().padStart(2, "0")
	);
}

/**
 * Given a string, consider only the digits and take the last two digits as minutes
 * and all preceding digits as hours (sort of like a microwave oven), and convert
 * it to a number of minutes.
 * Will clamp output to between 00:00 and 23:59.
 *
 * @returns The number of minutes that the string was interpreted to represent.
 * 			Might return zero if the string wasn't properly formatted.
 * @example sexagesimalToMinutes("59") // => 59
 *          sexagesimalToMinutes("60") // => 60
 *          sexagesimalToMinutes("90") // => 90
 *          sexagesimalToMinutes("99") // => 99
 *          sexagesimalToMinutes("100") // => 60
 *          sexagesimalToMinutes("130") // => 90
 *          sexagesimalToMinutes("1230") // => 750
 */
function sexagesimalToMinutes(sexagesimal: string): number {
	const digitsOnly = sexagesimal.replaceAll(/[^\d]/g, "");
	const length = digitsOnly.length;
	const hourString = digitsOnly.substring(0, length - 2);
	const minuteString = digitsOnly.substring(length - 2);
	const hours = Number.parseInt(hourString) || 0;
	const minutes = Number.parseInt(minuteString) || 0;
	return clampToValidMinutes(hours * 60 + minutes);
}

/**
 * @returns The number minutes provided, but clamped between 00:00 and 23:59 hours.
 */
function clampToValidMinutes(minutes: number): number {
	return Math.clamp(minutes, 0, 24 * 60 - 1);
}
