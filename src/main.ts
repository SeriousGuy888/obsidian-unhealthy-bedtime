import {
	App,
	ButtonComponent,
	FileView,
	Modal,
	Plugin,
	Setting,
	TFile,
	WorkspaceLeaf,
	moment,
	normalizePath,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	UnhealthyBedtimeSettings,
	UnhealthyBedtimeSettingTab,
} from "./settings";
import {
	createDailyNote,
	DEFAULT_DAILY_NOTE_FORMAT,
	getAllDailyNotes,
	getDailyNote,
	getDailyNoteSettings,
} from "obsidian-daily-notes-interface";
import {
	removeInlineTitleAnnotation,
	updateInlineTitleAnnotation,
} from "inlineTitleAnnotation";

// Remember to rename these classes and interfaces!

export default class UnhealthyBedtimePlugin extends Plugin {
	private static singletonInstance: UnhealthyBedtimePlugin; // nosonar

	settings: UnhealthyBedtimeSettings;

	constructor(app: App, manifest: any) {
		super(app, manifest);
		UnhealthyBedtimePlugin.singletonInstance = this;
	}

	static getInstance(): UnhealthyBedtimePlugin {
		return UnhealthyBedtimePlugin.singletonInstance;
	}

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new UnhealthyBedtimeSettingTab(this.app, this));

		// Register commands
		this.addCommand({
			id: "open-todays-daily-note-in-current-leaf",
			name: "Open today's daily note while considering configured bedtime",
			callback: async () => {
				const shouldCreateWithoutConfirmation =
					!this.settings.confirmBeforeCreatingNonexistentDailyNote;

				const managedToOpen = await this.tryOpenTodaysDailyNote(
					shouldCreateWithoutConfirmation
				);

				if (!managedToOpen && !shouldCreateWithoutConfirmation) {
					// if failed to open, and the first attempt did not try to create the note

					new PermissionToCreateDailyNoteModal(
						this.app,
						this,
						() => void this.tryOpenTodaysDailyNote(true)
					).open();
				}
			},
		});

		this.app.workspace.onLayoutReady(() => {
			this.updateAnnotationsOnOpenDailyNotes();

			this.registerEvent(
				this.app.vault.on("rename", (renamedFile: TFile) => {
					this.updateAnnotationsOnOpenDailyNotes(renamedFile);
				})
			);

			this.registerEvent(
				// update annotations when the user switches between live preview and reading mode
				// (which is needed because reading mode uses different dom elements from live preview mode,
				// so the annotation has to be created again)
				this.app.workspace.on("layout-change", () => {
					this.updateAnnotationsOnOpenDailyNotes();
				})
			);

			this.registerEvent(
				this.app.workspace.on(
					"active-leaf-change",
					(leaf: WorkspaceLeaf | null) => {
						if (
							leaf &&
							leaf.view instanceof FileView &&
							leaf.view.file
						) {
							updateInlineTitleAnnotation(
								this.app.workspace.getLeaf(),
								leaf.view.file
							);
						}
					}
				)
			);
		});
	}

	onunload() {
		this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
			removeInlineTitleAnnotation(leaf);
		});
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
	 * @param specificallyThisFile If specified, only the annotations on views that have
	 *                             this specific file open will be updated.
	 *                             If not specified, then all views that have a daily note open
	 *                             will have their annotations updated.
	 */
	updateAnnotationsOnOpenDailyNotes(specificallyThisFile?: TFile) {
		this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
			const view = leaf.view;
			const isFileView = view instanceof FileView;

			// don't bother if this view isn't even editing a file
			if (!isFileView || !view.file) {
				return;
			}

			// if we're searching to update only views that have open one specific file,
			// then don't bother if the file this view has open is not that file
			if (specificallyThisFile && view.file !== specificallyThisFile) {
				return;
			}

			// don't bother if the note isn't a daily note
			if (this.isDailyNote(view.file)) {
				updateInlineTitleAnnotation(leaf, view.file);
			}
		});
	}

	isDailyNote(file: TFile): boolean {
		return !!this.getDailyNoteCharacteristics(file);
	}

	getDailyNoteCharacteristics(
		file: TFile
	): { from: moment.Moment; to: moment.Moment } | null {
		const { folder, format } = {
			folder: "",
			format: DEFAULT_DAILY_NOTE_FORMAT,
			...getDailyNoteSettings(),
		};

		// console.debug(
		// 	file,
		// 	file.basename,
		// 	file.extension,
		// 	file.name,
		// 	file.path,
		// 	folder
		// );

		if (file.extension.toLowerCase() !== "md") {
			return null;
		}

		if (
			normalizePath(file.path) !== normalizePath(folder + "/" + file.name)
		) {
			return null;
		}

		const offsetStartOfTheDay = moment(file.basename, format, true).add(
			this.settings.minutesAfterMidnightCutoff,
			"minutes"
		);
		const offsetEndOfTheDay = offsetStartOfTheDay.clone().add(1, "day");

		if (!offsetStartOfTheDay.isValid()) {
			return null;
		}

		return { from: offsetStartOfTheDay, to: offsetEndOfTheDay };
	}

	/**
	 * @returns false if the note doesn't exist, or if an attempt to create it was made, but failed
	 *          true if successful
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
		let todaysDailyNote = getDailyNote(offsetNow, getAllDailyNotes());

		if (!todaysDailyNote) {
			// If today's daily note doesn't actually exist.

			if (shouldCreateIfNonexistent) {
				// this never throws an error seemingly, though it might return undefined
				todaysDailyNote = await createDailyNote(offsetNow);
			} else {
				return false;
			}
		}

		const leaf = this.app.workspace.getLeaf();

		if (todaysDailyNote) {
			void leaf.openFile(todaysDailyNote); // this never seems to throw, even if file is undefined

			console.debug(
				`now = ${new Date().toLocaleString()}.\n`,
				`cutoff = ${this.settings.minutesAfterMidnightCutoff} minutes.\n`,
				`pretending that now = ${offsetNow
					.toDate()
					.toLocaleString()}.\n`,
				`Therefore opening ${todaysDailyNote.name}.`
			);
			return true;
		}

		console.warn("Failed to retrieve or create daily note.");
		return false;
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
		const fragment = new DocumentFragment();
		fragment.appendChild(p);
		fragment.appendChild(br);

		this.setContent(fragment);

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
