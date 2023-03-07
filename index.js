const statusFileName = "status.json";
const checkIntervalInMs = 5 * 60 * 1000 // 5 minutes

const Discord = require("discord.js")
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

var channel;

var status = {};
status.groups = {};
status.actions = {};

if (fs.existsSync(statusFileName))
{
	try
	{
		logInfo("Status file was found.");
		fs.readFile(statusFileName, 'utf8', function readFileCallback(err, data){
			if (err)
			{
				logInfo(err);
			} else {
				try 
				{
					status = JSON.parse(data);
				}
				catch (err)
				{
					logInfo(err);
				}
			}
		});
	}
	catch (err)
	{
		logInfo(err);
	}

}

client.on("ready", () => {
	logInfo(`Logged in as ${client.user.tag}!`);

	channel = client.channels.cache.find(channel => channel.name === "bot-alerts");
	logInfo(`Bot channel id: ${channel.id}`);

	// First process right after initialization
	process();
	
	// Further processes every interval
	setInterval(process, checkIntervalInMs); 
})

/* client.on("message", msg => {
  logInfo('Incoming message ${msg}')
  msg.reply("pong");
})*/

client.login(config.token);

function logInfo(info)
{
    var timestamp = '[' + new Date().toLocaleString() + '] ';
    console.log(timestamp, info);	
}

function process()
{
	try
	{
		processGroups();
		
		// Save new status
		logInfo("Saving new status...");
		var json = JSON.stringify(status, null, 2);
		fs.writeFile(statusFileName, json, 'utf8', function(err) { if (err) logInfo(err); });

	}
	catch (err)
	{
		logInfo(err);
	}
}


function processGroups()
{
	logInfo("Checking groups...");

	var data = loadPage("http://www.slothmud.org/wp/live-info/adventuring-parties");

	var re = /(\w+) is leading '(.*?)' on/g;
	var m;

	var newGroups = {}
	do {
		m = re.exec(data);
		if(m) {
			var leader = m[1];
			var groupName = m[2];

			newGroups[leader] = groupName;
			logInfo(`${leader}, ${groupName}`);
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
}

function loadPage(url)
{
	request = new XMLHttpRequest();
	request.open('get', url, false);
	request.send();
	
	if (request.status != 200)
	{
		throw `Could not fetch '${url}'. Status code: ${request.status}`;
	}
	
	return request.responseText;
};

