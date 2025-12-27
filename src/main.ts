import {
	App,
	Modal,
	Plugin,
	moment,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	UnhealthyBedtimeSettings,
	UnhealthyBedtimeSettingTab,
} from "./settings";
import { getAllDailyNotes, getDailyNote } from "obsidian-daily-notes-interface";

// Remember to rename these classes and interfaces!

export default class UnhealthyBedtimePlugin extends Plugin {
	settings: UnhealthyBedtimeSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new UnhealthyBedtimeSettingTab(this.app, this));

		// Register commands
		this.addCommand({
			id: "open-todays-daily-note-in-current-leaf",
			name: "Open today's daily note while considering configured bedtime",
			callback: () => {
				void this.openTodaysDailyNote();
			},
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = {
			...DEFAULT_SETTINGS,
			...((await this.loadData()) as UnhealthyBedtimeSettings),
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openTodaysDailyNote() {
		// Get the current time, and then pretend the current time is actually <cutoff> minutes before that.
		const offsetNow = moment().subtract(
			this.settings.minutesAfterMidnightCutoff,
			"minutes"
		);

		// Open the daily note for the time that we're pretending it is.
		const allDailyNotes = getAllDailyNotes();
		const todaysDailyNote = getDailyNote(offsetNow, allDailyNotes);
		const leaf = this.app.workspace.getLeaf();

		void leaf.openFile(todaysDailyNote);

		console.debug(
			`now = ${new Date().toLocaleString()}.\n`,
			`cutoff = ${this.settings.minutesAfterMidnightCutoff} minutes.\n`,
			`pretending that now = ${offsetNow.toDate().toLocaleString()}.\n`,
			`Therefore opening ${todaysDailyNote.name}.`
		);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
