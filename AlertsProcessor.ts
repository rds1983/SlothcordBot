import { Client, EmbedBuilder } from "discord.js";
import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";

enum EventType {
	Death,
	Raise,
	Shock
}

class Event {
	type: EventType;
	adventurer: string;
	doer: string;
	time: string;
}

export class AlertsProcessor extends BaseProcessorImpl<Event[]>
{
	constructor(client: Client) {
		super(client);
	}

	getName(): string {
		return "alerts";
	}

	runIntervalInMs(): number {
		return 30 * 1000;
	}

	private static processEvent(type: EventType, regex: string, text: string, time: string, newEvents: Event[], doerFirst: boolean): boolean {
		let re = new RegExp(regex, "s");
		let m = re.exec(text);
		if (m) {
			let adventurer: string;
			let doer: string;
			if (doerFirst) {
				adventurer = m[2];
				doer = m[1];
			} else {
				adventurer = m[1];
				doer = m[2];
			}

			let newEvent: Event =
			{
				type: type,
				adventurer: adventurer,
				doer: doer,
				time: time
			};

			newEvents.push(newEvent);

			return true;
		}

		return false;
	}

	async reportDeath(newPost: Event): Promise<void> {
		this.sendMessage(`${newPost.adventurer} was slain by ${newPost.doer}.`);
	}

	async reportRaise(adventurer: string, raiser: string): Promise<void> {
		// Find the raise message
		let raiseMessage = await this.findMessage(`${adventurer} was slain by`);

		if (raiseMessage == null) {
			this.logInfo(`WARNING: could not find deatg message of ${adventurer}`);
			return;
		} else {
			this.logInfo(`Death message id: ${raiseMessage.id}`);
		}

		let embed = raiseMessage.embeds[0];

		let desc = embed.description;

		desc += `\nRaised by ${raiser}.`;

		// Edit the group message
		const newEmbed = new EmbedBuilder().setDescription(desc);
		await raiseMessage.edit({ embeds: [newEmbed] });

		await this.makeChannelWhite();
	}

	async reportShock(adventurer: string): Promise<void> {
		// Find the raise message
		let raiseMessage = await this.findMessage(`${adventurer} was slain by`);

		if (raiseMessage == null) {
			this.logInfo(`WARNING: could not find deatg message of ${adventurer}`);
			return;
		} else {
			this.logInfo(`Death message id: ${raiseMessage.id}`);
		}

		let embed = raiseMessage.embeds[0];

		let desc = embed.description;

		desc += `\nShocked.`;

		// Edit the group message
		const newEmbed = new EmbedBuilder().setDescription(desc);
		await raiseMessage.edit({ embeds: [newEmbed] });

		await this.makeChannelWhite();
	}

	async internalProcess(): Promise<void> {
		this.logInfo("Checking alerts...");

		let data = await this.loadPage("http://www.slothmud.org/wp/live-info/live-blog");
		let dom = new JSDOM(data);
		let document = dom.window.document;

		let newEvents: Event[] = [];
		let rows = document.getElementsByTagName("tr");
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];

			if (row.childNodes.length != 2) {
				continue;
			}

			let time = row.childNodes[0].textContent.trim();
			let eventText = row.childNodes[1].textContent.trim();

			// Check if it's death
			if (!AlertsProcessor.processEvent(EventType.Death, "(.+) handidly dispatched (\\w+) to to the next world\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) mercilessly slaughtered (\\w+)\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) mercilessly butchered (\\w+)\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) obliterated (\\w+)\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) annihilated (\\w+)\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) defeated (\\w+)\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) slew (\\w+)\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) wasted (\\w+)\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(.+) crushed (\\w+) to a liveless pulp of blood and offals\\.", eventText, time, newEvents, true) &&
				!AlertsProcessor.processEvent(EventType.Death, "(\\w+) was slain by (.+)\\.", eventText, time, newEvents, false) &&
				!AlertsProcessor.processEvent(EventType.Death, "(\\w+) was defeated by (.+)\\.", eventText, time, newEvents, false) &&
				!AlertsProcessor.processEvent(EventType.Death, "(\\w+) was messily dispatched by (.+)\\.", eventText, time, newEvents, false) &&
				!AlertsProcessor.processEvent(EventType.Death, "(\\w+) was beaten down by (.+)\\.", eventText, time, newEvents, false) &&
				!AlertsProcessor.processEvent(EventType.Death, "(\\w+) naively fought (.+) and lost\\.", eventText, time, newEvents, false) &&
				!AlertsProcessor.processEvent(EventType.Death, "(\\w+) fought against (.+) and lost\\.", eventText, time, newEvents, false)) {

				// Check if it's raise
				if (!AlertsProcessor.processEvent(EventType.Raise, "(\\w+) sold a piece of soul to the devil in exchange for (\\w+)'s worthless soul", eventText, time, newEvents, true) &&
					!AlertsProcessor.processEvent(EventType.Raise, "The clerical genius (\\w+) successfully raised (\\w+)\\.", eventText, time, newEvents, true) &&
					!AlertsProcessor.processEvent(EventType.Raise, "(\\w+)'s prayers were answered and (\\w+) was successfully raised\\.", eventText, time, newEvents, true) &&
					!AlertsProcessor.processEvent(EventType.Raise, "(\\w+) raised from the dead by (\\w+)\\.", eventText, time, newEvents, false)) {

					// Finally check if it's shock
					if (!AlertsProcessor.processEvent(EventType.Shock, "(\\w+) shocked (\\w+)\\.", eventText, time, newEvents, true) &&
						!AlertsProcessor.processEvent(EventType.Shock, "(\\w+) knelt, prayed, and still managed to shock (\\w+)\\.", eventText, time, newEvents, false) &&
						!AlertsProcessor.processEvent(EventType.Shock, "(\\w+) was banished to ether by (\\w+)'s lack of raising ability\\.", eventText, time, newEvents, false) &&
						!AlertsProcessor.processEvent(EventType.Shock, "The gods liked (\\w+)'s soul so much that they want to keep it\\s+\\-\\s+(\\w+) was not convincing enough to cheat death.", eventText, time, newEvents, false)) {
						this.logInfo(`'${eventText}' neither death or raise or shock.`);
					}
				}
			}
		}

		if (this.status != null) {
			let oldTopEvent = this.status[0];
			let oldTopEventIndex = 0;
			for (let i = 0; i < newEvents.length; ++i) {
				let newPost = newEvents[i];

				if (newPost.type == oldTopEvent.type && newPost.adventurer == oldTopEvent.adventurer && newPost.doer == oldTopEvent.doer) {
					oldTopEventIndex = i;
					break;
				}
			}

			this.logInfo(`oldTopEventIndex: ${oldTopEventIndex}`);

			// All events before oldTopPostIndex are new
			for (let i = 0; i < oldTopEventIndex; ++i) {
				let newPost = newEvents[i];

				if (newPost.type == EventType.Death) {
					await this.reportDeath(newPost);
				} else if (newPost.type == EventType.Raise) {
					await this.reportRaise(newPost.adventurer, newPost.doer);
				} else if (newPost.type == EventType.Shock) {
					await this.reportShock(newPost.adventurer);
				}
			}
		}

		this.status = newEvents;
		this.saveStatus();
	}

	process(): void {
		this.internalProcess().catch(err => this.logError(err));
	}
}