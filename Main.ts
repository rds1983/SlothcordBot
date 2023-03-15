import { Client, GatewayIntentBits } from "discord.js";
import { BaseProcessor } from "./BaseProcessor";
import { EmporiumProcessor } from "./EmporiumProcessor";
import { EpicsProcessor } from "./EpicsProcessor";
import { ForumProcessor } from "./ForumProcessor";
import { GroupsProcessor } from "./GroupsProcessor";

const config = require('./config.json');

var processors: BaseProcessor[] = [];

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

	for (var i = 0; i < processors.length; ++i) {
		processors[i].start();
	}
});

client.login(config.token);