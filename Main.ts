import { Client, GatewayIntentBits } from "discord.js";
import { AlertsProcessor } from "./AlertsProcessor";
import { BaseProcessor } from "./BaseProcessor";
import { EmporiumProcessor } from "./EmporiumProcessor";
import { EpicsProcessor } from "./EpicsProcessor";
import { ForumProcessor } from "./ForumProcessor";
import { Global } from "./Global";
import { GroupsProcessor } from "./GroupsProcessor";

Global.config = require('./config.json');

let processors: BaseProcessor[] = [];

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	]
});

client.on("ready", () => {
	processors.push(new GroupsProcessor(client));
	processors.push(new EpicsProcessor(client));
	processors.push(new EmporiumProcessor(client));
	processors.push(new ForumProcessor(client));
	processors.push(new AlertsProcessor(client));

	for (let i = 0; i < processors.length; ++i) {
		processors[i].start();
	}
});

client.login(Global.config.token);