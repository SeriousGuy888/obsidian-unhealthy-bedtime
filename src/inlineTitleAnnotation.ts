import UnhealthyBedtimePlugin from "main";
import { TFile, View, WorkspaceLeaf, moment } from "obsidian";

/**
 * The inline title element (from Obsidian itself) has this class.
 * The element exists both in editing mode and in reading mode.
 * The element also exists even when the "show inline title" setting is disabled (just set to `display: none;`).
 */
const INLINE_TITLE_CLASS_NAME = "inline-title";

/**
 * The class to be assigned to the annotation that this plugin adds,
 * so that it can be easily found and removed later.
 */
const ANNOTATION_CLASS_NAME =
	"unhealthy-bedtime__daily-note-inline-title-annotation";

export function updateInlineTitleAnnotation(leaf: WorkspaceLeaf, file: TFile) {
	const characteristics =
		UnhealthyBedtimePlugin.getInstance().getDailyNoteCharacteristics(file);

	if (!characteristics) {
		removeInlineTitleAnnotation(leaf);
		return;
	}

	const { from, to } = characteristics;

	const activeView: View = leaf.view;
	const viewContainer: HTMLElement = activeView.containerEl;

	// Find the inline title container
	const inlineTitle = viewContainer.querySelector(
		"." + INLINE_TITLE_CLASS_NAME
	);
	if (!inlineTitle) {
		return;
	}

	const container = inlineTitle.parentNode;
	if (!container) {
		return;
	}

	// Remove existing annotation
	removeInlineTitleAnnotation(leaf);

	const now = moment();
    let annotation: string = "";
    if (from <= now && now < to) {
        annotation = "(This is today's daily note.)"
    } else {
        annotation = "(This is not today's daily note.)"
    }

	// Add annotation element
	const span = inlineTitle.createDiv({
		cls: ANNOTATION_CLASS_NAME,
		text: annotation,
	});

	if (container) {
		container.insertAfter(span, inlineTitle);
	}
}

export function removeInlineTitleAnnotation(leaf: WorkspaceLeaf) {
	leaf.view.containerEl.querySelector("." + ANNOTATION_CLASS_NAME)?.remove();
}
