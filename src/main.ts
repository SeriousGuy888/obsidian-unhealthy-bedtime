import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	moment,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	MyPluginSettings,
	SampleSettingTab,
} from "./settings";
import { getAllDailyNotes, getDailyNote } from "obsidian-daily-notes-interface";

// Remember to rename these classes and interfaces!

export default class UnhealthyBedtimePlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Register commands
		this.addCommand({
			id: "open-todays-daily-note-in-current-leaf",
			name: "Open today's daily note while considering configured bedtime",
			callback: () => {
				this.openTodaysDailyNote();
			},
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = {
			...DEFAULT_SETTINGS,
			...((await this.loadData()) as Partial<MyPluginSettings>),
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openTodaysDailyNote() {
		const allDailyNotes = getAllDailyNotes();
		const todaysDailyNote = getDailyNote(moment(), allDailyNotes);
		const leaf = this.app.workspace.getLeaf()
		leaf.openFile(todaysDailyNote)
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
