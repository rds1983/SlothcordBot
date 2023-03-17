import { Client, EmbedBuilder } from "discord.js";
import { BaseProcessorImpl } from "./BaseProcessor";
import { Utility } from "./Utility";
import { JSDOM } from 'jsdom';

class Group {
	leader: string;
	initialLeader: string;
	name: string;
	adventurers: string[];
	started: number;
}

export class GroupsProcessor extends BaseProcessorImpl<{ [leader: string]: Group }> {
	constructor(client: Client) {
		super(client);
	}

	getName(): string {
		return "groups";
	}

	runIntervalInMs(): number {
		return 5 * 60 * 1000;
	}

	async appendMessage(leader: string, append: string, started: number): Promise<void> {
		this.logInfo(`appendAndReportMessage for the group of ${leader}: ${append}`);

		// Find the group message
		let groupMessage = null;
		let messages = await this.channel.messages.fetch({ limit: 10 });
		let messagesArray = Array.from(messages.values());
		for (let i = 0; i < messagesArray.length; ++i) {
			let message = messagesArray[i];
			if (message.embeds.length == 0) {
				continue;
			}
			let embed = message.embeds[0];

			if (embed.description.includes(`${leader} has started`)) {
				groupMessage = message;
				this.logInfo(`Group message id: ${groupMessage.id}`);
				break;
			}
		}

		if (groupMessage == null) {
			this.logInfo(`WARNING: could not find message for group of ${leader}`);
			return;
		}

		let embed = groupMessage.embeds[0];

		let desc = embed.description;

		desc += "\n";
		if (started != null) {
			let diff = new Date().getTime() - started;
			let hours = Math.floor(diff / (1000 * 60 * 60));
			diff -= hours * (1000 * 60 * 60);

			let mins = Math.floor(diff / (1000 * 60));
			diff -= mins * (1000 * 60);

			desc += `(+${Utility.formatTwoDigits(hours)}:${Utility.formatTwoDigits(mins)})`;
		} else {
			desc += `(${Utility.formatCurrentTime()})`;
		}

		desc += ` ${append}`;

		// Edit the group message
		const newEmbed = new EmbedBuilder().setDescription(desc);
		await groupMessage.edit({ embeds: [newEmbed] });

		await this.makeChannelWhite();
	}


	async internalProcess(): Promise<void> {
		let data = await this.loadPage("http://www.slothmud.org/wp/live-info/adventuring-parties");
		let dom = new JSDOM(data);
		let document = dom.window.document;

		let all = document.getElementsByTagName("tr");
		let newGroups: { [leader: string]: Group } = {};
		let group: Group = null;
		for (let i = 0; i < all.length; i++) {
			let children = all[i].childNodes;

			// Check if it's group header row
			let td = children[0];
			if ("colSpan" in td && td.colSpan == "3") {
				let re = /(\w+) is leading '(.*)' /;
				let m = re.exec(td.textContent);
				if (m) {
					// Store last group
					if (group != null) {
						newGroups[group.leader] = group;
					}

					let name = m[2];
					let leader = m[1];

					group =
					{
						initialLeader: leader,
						leader: leader,
						name: name,
						adventurers: [],
						started: null
					};

					continue;
				}
			}

			if (group == null) {
				continue;
			}

			if (children.length == 3) {
				// Member row
				group.adventurers.push(children[2].textContent.trim());
			}
		}

		// Store last group
		// Store existing group
		if (group != null) {
			newGroups[group.leader] = group;
		}

		if (this.status != null) {
			// Update initial leaders
			for (let leader in newGroups) {
				let newGroup = newGroups[leader];
				if (leader in this.status) {
					let oldGroup = this.status[leader];
					newGroup.initialLeader = oldGroup.initialLeader;

					if ("started" in oldGroup) {
						newGroup.started = oldGroup.started;
					}
				}
			}

			// Check for groups that were over or had changed the leader
			let leaderChanges: { [leader: string]: string } = {};
			for (let oldLeader in this.status) {
				let oldGroup = this.status[oldLeader];
				if (!(oldLeader in newGroups)) {

					// Check for the leader change
					let changedLeader = false;
					for (let newLeader in newGroups) {
						let newGroup = newGroups[newLeader];

						let matches = 0;

						// Calculate how many adventurers from the old group presents in the new group
						for (let i = 0; i < oldGroup.adventurers.length; ++i) {
							for (let j = 0; j < newGroup.adventurers.length; ++j) {
								if (oldGroup.adventurers[i] == newGroup.adventurers[j]) {
									++matches;
								}
							}
						}

						this.logInfo(`Amount of matches for ${oldLeader}/${newLeader}: ${matches}`);

						// If rate of matches >= 0.5 for both groups, then it's the leader change
						if (matches / oldGroup.adventurers.length >= 0.5 && matches / newGroup.adventurers.length >= 0.5) {
							changedLeader = true;
							newGroup.initialLeader = oldGroup.initialLeader;
							newGroup.started = oldGroup.started;
							leaderChanges[oldLeader] = newLeader;
							await this.appendMessage(oldGroup.initialLeader, `The new leader is ${newLeader}.`, oldGroup.started);
							break;
						}
					}

					if (!changedLeader) {
						await this.appendMessage(oldGroup.initialLeader, `The group is over.`, oldGroup.started);
					}
				}
			}

			// Update old groups with the leader changes
			for (let oldLeader in leaderChanges) {
				let newLeader = leaderChanges[oldLeader];
				let oldGroup = this.status[oldLeader];
				delete this.status[oldLeader];
				this.status[newLeader] = oldGroup;
			}

			// Check for new and renamed groups
			for (let newLeader in newGroups) {
				let newGroup = newGroups[newLeader];
				if (!(newLeader in this.status)) {
					newGroup.started = new Date().getTime();
					await this.sendMessage(`${newLeader} has started group '${newGroup.name}'. Group consists of ${newGroup.adventurers.length} adventurers.`)
				} else {
					let oldGroup = this.status[newLeader];

					if (oldGroup.name != newGroup.name) {
						await this.appendMessage(oldGroup.initialLeader, `${newLeader} has changed group name to '${newGroup.name}'`, oldGroup.started);
					}

					let oldSizeDivided = Math.floor(oldGroup.adventurers.length / 4);
					let newSizeDivided = Math.floor(newGroup.adventurers.length / 4);

					if (newSizeDivided > oldSizeDivided) {
						await this.appendMessage(oldGroup.initialLeader, `The group has became bigger. Now it has as many as ${newGroup.adventurers.length} adventurers.`, oldGroup.started);
					}

					if (newSizeDivided < oldSizeDivided) {
						await this.appendMessage(oldGroup.initialLeader, `The group has became smaller. Now it has only ${newGroup.adventurers.length} adventurers.`, oldGroup.started);
					}
				}
			}
		}

		// Log groups
		for (let newLeader in newGroups) {
			let newGroup = newGroups[newLeader];
			this.logInfo(Utility.toString(newGroup));
		}

		this.status = newGroups;
		this.saveStatus();
	}

	process(): void {
		this.internalProcess().catch(err => this.logError(err));
	}
}