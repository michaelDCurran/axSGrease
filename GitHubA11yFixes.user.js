// ==UserScript==
// @name           GitHub Accessibility Fixes
// @namespace      http://axSgrease.nvaccess.org/
// @description    Improves the accessibility of GitHub.
// @author         James Teh <jteh@mozilla.com>
// @copyright 2019 Mozilla Corporation, Derek Riemer
// @license Mozilla Public License version 2.0
// @version        2019.1
// @include https://github.com/*
// ==/UserScript==

/*** Functions for common tweaks. ***/

function makeHeading(el, level) {
	el.setAttribute("role", "heading");
	el.setAttribute("aria-level", level);
}

function makeRegion(el, label) {
	el.setAttribute("role", "region");
	el.setAttribute("aria-label", label);
}

function makeButton(el, label) {
	el.setAttribute("role", "button");
	el.setAttribute("aria-label", label);
}

function makePresentational(el) {
	el.setAttribute("role", "presentation");
}

function setLabel(el, label) {
	el.setAttribute("aria-label", label);
}

function makeHidden(el) {
	el.setAttribute("aria-hidden", "true");
}

function setExpanded(el, expanded) {
	el.setAttribute("aria-expanded", expanded ? "true" : "false");
}

var idCounter = 0;
// Get a node's id. If it doesn't have one, make and set one first.
function setAriaIdIfNecessary(elem) {
	if (!elem.id) {
		elem.setAttribute("id", "axsg-" + idCounter++);
	}
	return elem.id;
}

function makeElementOwn(parentElement, listOfNodes){
	ids = [];
	for(let node of listOfNodes){
		ids.push(setAriaIdIfNecessary(node));
	}
	parentElement.setAttribute("aria-owns", ids.join(" "));
}

/*** Code to apply the tweaks when appropriate. ***/

function applyTweak(el, tweak) {
	if (Array.isArray(tweak.tweak)) {
		let [func, ...args] = tweak.tweak;
		func(el, ...args);
	} else {
		tweak.tweak(el);
	}
}

function applyTweaks(root, tweaks, checkRoot) {
	for (let tweak of tweaks) {
		for (let el of root.querySelectorAll(tweak.selector)) {
			applyTweak(el, tweak);
		}
		if (checkRoot && root.matches(tweak.selector)) {
			applyTweak(root, tweak);
		}
	}
}

let observer = new MutationObserver(function(mutations) {
	for (let mutation of mutations) {
		try {
			if (mutation.type === "childList") {
				for (let node of mutation.addedNodes) {
					if (node.nodeType != Node.ELEMENT_NODE) {
						continue;
					}
					applyTweaks(node, DYNAMIC_TWEAKS, true);
				}
			} else if (mutation.type === "attributes") {
				applyTweaks(mutation.target, DYNAMIC_TWEAKS, true);
			}
		} catch (e) {
			// Catch exceptions for individual mutations so other mutations are still handled.
			console.log("Exception while handling mutation: " + e);
		}
	}
});

function init() {
	applyTweaks(document, LOAD_TWEAKS, false);
	applyTweaks(document, DYNAMIC_TWEAKS, false);
	options = {childList: true, subtree: true};
	if (DYNAMIC_TWEAK_ATTRIBS.length > 0) {
		options.attributes = true;
		options.attributeFilter = DYNAMIC_TWEAK_ATTRIBS;
	}
	observer.observe(document, options);
}

/*** Define the actual tweaks. ***/

// Tweaks that only need to be applied on load.
const LOAD_TWEAKS = [
];

// Attributes that should be watched for changes and cause dynamic tweaks to be
// applied. For example, if there is a dynamic tweak which handles the state of
// a check box and that state is determined using an attribute, that attribute
// should be included here.
const DYNAMIC_TWEAK_ATTRIBS = [];

// Tweaks that must be applied whenever a node is added/changed.
const DYNAMIC_TWEAKS = [
	// Lines of code which can be commented on.
	{selector: '.add-line-comment, span.blob-code-inner',
		tweak: el => {
			// Put the comment button after the code instead of before.
			let cell = el.parentNode;
			let code = cell.querySelector('.blob-code-inner');
			let comment = cell.querySelector('.add-line-comment');
			if (code && comment) {
				makeElementOwn(cell, [code, comment]);
			}
		}},
	// Make non-comment events into headings; e.g. closing/referencing an issue,
	// approving/requesting changes to a PR, merging a PR. Exclude commits and
	// commit references because these contain too much detail and there's no
	// way to separate the header from the body.
	{selector: '.TimelineItem:not(.js-commit) .TimelineItem-body:not(.my-0):not([id^="ref-commit-"])',
		tweak: [makeHeading, 3]},
	// Issue listing tables.
	{selector: '.js-navigation-container:not(.commits-listing)',
		tweak: el => el.setAttribute("role", "table")},
	{selector: '.Box-row:not(.js-commits-list-item)',
		tweak: el => el.setAttribute("role", "row")},
	{selector: '.Box-row .d-flex',
		tweak: el => {
			// There's one of these inside every row. It's purely presentational.
			makePresentational(el);
			// Its children are the cells, but they have no common class.
			for (let cell of el.children) {
				cell.setAttribute("role", "cell");
			}
		}},
	// Commit group headers in commit listings.
	{selector: '.commit-group-title',
		tweak: [makeHeading, 2]},
	// Project boards
	// Label columns
	{
		selector: '.js-project-column',
		tweak: el => {
			el.setAttribute('aria-roledescription', 'column');
			let heading = el.querySelector('h3');
			let headingId = setAriaIdIfNecessary(heading);
			el.setAttribute('aria-labelledby',headingId);
		},
	},
	// Label and describe cards
	{
		selector: '.js-project-column-card',
		tweak: el => {
			el.setAttribute('aria-roledescription', 'card');
			let label = "";
			let description = "";
			let commentBody = el.querySelector('.js-comment-body');
			if(commentBody) {
				label += "Note ";
				label += commentBody.innerText;
			} else if(el.matches('.issue-card')) {
				let octicon = el.querySelector('.js-issue-octicon');
				if(octicon) {
					if(octicon.matches('.octicon-issue-closed')) {
						label += "Closed issue ";
					} else if(octicon.matches('.octicon-issue-open')) {
						label += "Open issue ";
					} else if(octicon.matches('.octicon-git-pull-request.closed')) {
						label += "Closed PR ";
					} else if(octicon.matches('.octicon-git-pull-request.draft')) {
						label += "Draft PR ";
					} else if(octicon.matches('.octicon-git-pull-request.open')) {
						label += "Open PR ";
					} else if(octicon.matches('.octicon-git-pull-request.merged')) {
						label += "Merged PR ";
					} else {
						label += octicon.getAttribute('aria-label')+" ";
					}
				}
				let assignee = el.querySelector('.AvatarStack-body .avatar-user');
				if(assignee) {
					label += assignee.getAttribute('alt')+" ";
				}
				let issueLink = el.querySelector('.js-project-card-issue-link');
				label += issueLink.innerText;
				let details = issueLink.nextElementSibling;
				description += details.innerText;
			}
			el.setAttribute('aria-label', label);
			el.setAttribute('aria-description', description);
		},
	},
	// Make file names be headings,
	// and reorder the info so that it is
	// file name, number of changes, expand diff contents, copy
	{
		selector: '.file-info',
		tweak: el => {
			makeHeading(el, 2);
			let ownsString = [
				setAriaIdIfNecessary(el.children[2]),
				setAriaIdIfNecessary(el.children[1]),
				setAriaIdIfNecessary(el.children[0]),
				setAriaIdIfNecessary(el.children[3]),
			].join(" ");
			el.setAttribute('aria-owns', ownsString);
		},
	},
];

/*** Lights, camera, action! ***/
init();
