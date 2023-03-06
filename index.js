const statusFileName = "status.json";
const Discord = require("discord.js")
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');

// Include timestamp in the console log
console.logCopy = console.log.bind(console);

console.log = function(data)
{
    var timestamp = '[' + new Date().toLocaleString() + '] ';
    this.logCopy(timestamp, data);
};

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

var channel;

var status = {};
status.groups = {};

if (fs.existsSync(statusFileName))
{
	try
	{
		console.log("Status file was found.");
		fs.readFile(statusFileName, 'utf8', function readFileCallback(err, data){
			if (err)
			{
				console.log(err);
			} else {
				try 
				{
					status = JSON.parse(data);
				}
				catch (err)
				{
					console.log(err);
				}
			}
		});
	}
	catch (err)
	{
		console.log(err);
	}

}

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);

	channel = client.channels.cache.find(channel => channel.name === "bot-alerts");
	console.log(`Bot channel id: ${channel.id}`);

	// Check groups every minute
	setInterval(function() {
	console.log("Checking groups...");
	loadPage("http://www.slothmud.org/wp/live-info/adventuring-parties", processGroups);
	}, 60 * 1000); // 60 * 1000 milsec
})

/* client.on("message", msg => {
  console.log('Incoming message ${msg}')
  msg.reply("pong");
})*/

client.login(config.token);

function processGroups(data)
{
	var re = /(\w+) is leading '(.*?)' on/g;
	var m;

	var newGroups = {}
	do {
		m = re.exec(data);
		if(m) {
			var leader = m[1];
			var groupName = m[2];

			newGroups[leader] = groupName;
			console.log(`${leader}, ${groupName}`);
	  }
	} while (m);

	// Check for ended groups
	for(var leader in status.groups) 
	{
		if (!(leader in newGroups)) {
			channel.send (`${leader}'s group has ended.`)
		}
	}

	// Check for new and renamed groups
	for(var leader in newGroups)
	{
		var groupName = newGroups[leader];
		if(!(leader in status.groups))
		{
			channel.send(`${leader} has started group '${groupName}'`)
		} else if (status.groups[leader] != newGroups[leader])
		{
			channel.send(`${leader} has changed group name to '${groupName}'`)
		}
	}

	status.groups = newGroups;

	// Save new status
	var json = JSON.stringify(status, null, 2);
	fs.writeFile(statusFileName, json, 'utf8', function(err) { if (err) console.log(err); });
}

function loadPage(url, handler)
{
	qr=new XMLHttpRequest();
	qr.open('get', url);
	qr.send();
	qr.onload=function() 
	{
		handler(qr.responseText)
	}
};

