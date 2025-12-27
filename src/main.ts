import { App, ButtonComponent, Modal, Plugin, Setting, moment } from "obsidian";
import {
	DEFAULT_SETTINGS,
	UnhealthyBedtimeSettings,
	UnhealthyBedtimeSettingTab,
} from "./settings";
import {
	createDailyNote,
	getAllDailyNotes,
	getDailyNote,
} from "obsidian-daily-notes-interface";

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
			callback: async () => {
				const shouldBeBold =
					!this.settings.confirmBeforeCreatingNonexistentDailyNote;
				
				if (shouldBeBold) {
					void this.tryOpenTodaysDailyNote(true);
				} else {
					const managedToOpen = await this.tryOpenTodaysDailyNote(
						false
					);

					if (!managedToOpen) {
						new PermissionToCreateDailyNoteModal(
							this.app,
							this,
							() => void this.tryOpenTodaysDailyNote(true)
						).open();
					}
				}
			},
		});
	}

	onunload() {
		// nothing needed here for now
	}

	async loadSettings() {
		this.settings = {
			...DEFAULT_SETTINGS,
			...((await this.loadData()) as UnhealthyBedtimeSettings),
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * @returns true if successful, false if the note doesn't exist yet
	 */
	async tryOpenTodaysDailyNote(
		shouldCreateIfNonexistent: boolean
	): Promise<boolean> {
		// Get the current time, and then pretend the current time is actually <cutoff> minutes before that.
		const offsetNow = moment().subtract(
			this.settings.minutesAfterMidnightCutoff,
			"minutes"
		);

		// Open the daily note for the time that we're pretending it is.
		const allDailyNotes = getAllDailyNotes();
		let todaysDailyNote = getDailyNote(offsetNow, allDailyNotes);

		if (!todaysDailyNote) {
			// If today's daily note doesn't actually exist.

			if (shouldCreateIfNonexistent) {
				todaysDailyNote = await createDailyNote(offsetNow);
			} else {
				return false;
			}
		}

		const leaf = this.app.workspace.getLeaf();
		void leaf.openFile(todaysDailyNote); // im pretty sure this promise never rejects, even if file doesn't exist

		console.debug(
			`now = ${new Date().toLocaleString()}.\n`,
			`cutoff = ${this.settings.minutesAfterMidnightCutoff} minutes.\n`,
			`pretending that now = ${offsetNow.toDate().toLocaleString()}.\n`,
			`Therefore opening ${todaysDailyNote.name}.`
		);

		return true;
	}
}

class PermissionToCreateDailyNoteModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: UnhealthyBedtimePlugin,
		private readonly createNoteCallback: () => void
	) {
		super(app);
		this.setTitle("New Daily Note"); // eslint-disable-line obsidianmd/ui/sentence-case

		const br = document.createElement("br");
		const p = document.createElement("p");
		p.setText(
			"Today's daily note doesn't exist yet. Do you want to create it?"
		);
		const frament = new DocumentFragment();
		frament.appendChild(p);
		frament.appendChild(br);

		this.setContent(frament);

		this.init();
	}

	private init() {
		// sonarlint made me move the asynchronous stuff outside of the constructor :(

		new Setting(this.contentEl)
			.addButton((button: ButtonComponent) => {
				button.setButtonText("Never mind").onClick(() => {
					this.close();
				});
			})
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText("Create")
					.setCta()
					.onClick(() => {
						this.close();
						this.createNoteCallback();
					});
			});
		new Setting(this.contentEl)
			.setDesc("You can change this later in the plugin settings.")
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText("Create and don't ask again")
					.setCta()
					.onClick(() => {
						this.close();
						this.createNoteCallback();

						this.plugin.settings.confirmBeforeCreatingNonexistentDailyNote =
							false;
						void this.plugin.saveSettings();
					});
			});
	}
}
