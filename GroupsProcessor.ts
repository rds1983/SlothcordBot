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
		var groupMessage = null;
		var messages = await this.channel.messages.fetch({ limit: 10 });
		var messagesArray = Array.from(messages.values());
		for (var i = 0; i < messagesArray.length; ++i) {
			var message = messagesArray[i];
			if (message.embeds.length == 0) {
				continue;
			}
			var embed = message.embeds[0];

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

		var embed = groupMessage.embeds[0];

		var desc = embed.description;

		desc += "\n";
		if (started != null) {
			var diff = new Date().getTime() - started;
			var hours = Math.floor(diff / (1000 * 60 * 60));
			diff -= hours * (1000 * 60 * 60);

			var mins = Math.floor(diff / (1000 * 60));
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
		var data = await this.loadPage("http://www.slothmud.org/wp/live-info/adventuring-parties");
		var dom = new JSDOM(data);
		var document = dom.window.document;

		var all = document.getElementsByTagName("tr");
		var newGroups: { [leader: string]: Group } = {};
		var group: Group = null;
		for (var i = 0; i < all.length; i++) {
			var children = all[i].childNodes;

			// Check if it's group header row
			var td = children[0];
			if ("colSpan" in td && td.colSpan == "3") {
				var re = /(\w+) is leading '(.*)' /;
				var m = re.exec(td.textContent);
				if (m) {
					// Store last group
					if (group != null) {
						newGroups[group.leader] = group;
					}

					var name = m[2];
					var leader = m[1];

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
			for (var leader in newGroups) {
				var newGroup = newGroups[leader];
				if (leader in this.status) {
					var oldGroup = this.status[leader];
					newGroup.initialLeader = oldGroup.initialLeader;

					if ("started" in oldGroup) {
						newGroup.started = oldGroup.started;
					}
				}
			}

			// Check for groups that were over or had changed the leader
			var leaderChanges: { [leader: string]: boolean } = {};
			for (var leader in this.status) {
				var oldGroup = this.status[leader];
				if (!(leader in newGroups)) {
					// Check for the leader change
					var changedLeader = false;
					for (var newLeader in newGroups) {
						for (var i = 0; i < oldGroup.adventurers.length; ++i) {
							if (oldGroup.adventurers[i] == newLeader && Math.abs(newGroups[newLeader].adventurers.length - oldGroup.adventurers.length) <= 3) {
								// Leader change
								await this.appendMessage(oldGroup.initialLeader, `The new leader is ${newLeader}.`, oldGroup.started);
								newGroups[newLeader].initialLeader = oldGroup.initialLeader;
								newGroups[newLeader].started = oldGroup.started;
								leaderChanges[newLeader] = true;
								changedLeader = true;
							}
						}
					}

					if (!changedLeader) {
						await this.appendMessage(oldGroup.initialLeader, `The group is over.`, oldGroup.started);
					}
				}
			}

			// Check for new and renamed groups
			for (var leader in newGroups) {
				var newGroup = newGroups[leader];
				if (!(leader in this.status)) {
					if (!(leader in leaderChanges)) {
						newGroup.started = new Date().getTime();
						await this.sendMessage(`${leader} has started group '${newGroup.name}'. Group consists of ${newGroup.adventurers.length} adventurers.`)
					}
				} else {
					var oldGroup = this.status[leader];

					if (oldGroup.name != newGroup.name) {
						await this.appendMessage(oldGroup.initialLeader, `${leader} has changed group name to '${newGroup.name}'`, oldGroup.started);
					}

					var oldSizeDivided = Math.floor(oldGroup.adventurers.length / 4);
					var newSizeDivided = Math.floor(newGroup.adventurers.length / 4);

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
		for (var leader in newGroups) {
			var newGroup = newGroups[leader];
			this.logInfo(Utility.toString(newGroup));
		}

		this.status = newGroups;
		this.saveStatus();
	}

	process(): void {
		this.internalProcess().catch(err => this.logError(err));
	}
}