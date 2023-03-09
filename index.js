const statusFileName = "status.json";
const checkIntervalInMs = 5 * 60 * 1000 // 5 minutes

const { EmbedBuilder, Discord } = require('discord.js');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	]
});

var channelBotAlerts;
var channelEmporium;
var channelEpics;

var status = {};
status.groups = {};
status.auctions = {};
status.epics = [];

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

	channelBotAlerts = findChannelByName("bot-groups");
	channelEmporium = findChannelByName("bot-emporium");
	channelEpics = findChannelByName("bot-epics");

	// First process right after initialization
	process();
	
	// Further processes every interval
	setInterval(process, checkIntervalInMs); 
});

client.on('messageCreate', msg => {
	if (msg.author.bot)
	{
		// Ignore bot messages
		return;
	}

	var content = msg.content;
	if (!content.startsWith("!"))
	{
		// Not a command
		return;
	}

	try {
	var command = msg.content.substring(1);
	logInfo(`Command: ${command}`);

	if (command == "epics")
	{
		var result = "";
		for (var i = 0; i < status.epics.length; ++i)
		{
			var epic = status.epics[i];
			result += `${i + 1}. ${epic.name} in ${epic.area} at ${epic.continent}\n`;
		}

		sendMessage(msg.channel, result);
	}
	}
	catch(err)
	{
		logInfo(err);
	}
});


client.login(config.token);

function logInfo(info)
{
    var timestamp = '[' + new Date().toLocaleString() + '] ';
    console.log(timestamp, info);	
}

function isEmpty(map) 
{
	for (var key in map) 
	{
		if (map.hasOwnProperty(key)) 
		{
			return false;
		}
	}
	return true;
}

function isNumeric(str) 
{
  if (typeof str != "string") return false // we only process strings!  
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
         !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function findChannelByName(id)
{
	var channel = client.channels.cache.find(channel => channel.name === id);
	logInfo(`Channel #${id}'s id: ${channel.id}`);
	
	return channel;
}

function sendMessage(channel, message)
{
	logInfo (`${message}`);
	
	const embed = new EmbedBuilder().setDescription(message);
	channel.send({ embeds: [embed] });
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

function process()
{
	try
	{
		processGroups();
		processAuctions();
		processEpics();

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
	const dom = new JSDOM(data);
	var document = dom.window.document;

	var state = 0;
	var all = document.getElementsByTagName("tr");
	var newGroups = {};
	var group = null;
	for (var i = 0; i < all.length; i++) 
	{
		var children = all[i].childNodes;
		
		// Check if it's group header row
		var td = children[0];
		if ("colSpan" in td && td.colSpan == "3")
		{
			var re = /(\w+) is leading '(.*)' on/;
			var m = re.exec(td.textContent);
			if (m)
			{
				// Store last group
				if (group != null)
				{
					newGroups[group.leader] = group;
				}
				
				group = {};
				group.leader = m[1];
				group.name = m[2];
				group.size = 0;

				continue;
			}
		}
		
		if (group == null)
		{
			continue;
		}
		
		if (children.length == 3)
		{
			// Member row
			++group.size;
		}
	}
	
	// Store last group
	// Store existing group
	if (group != null)
	{
		newGroups[group.leader] = group;
	}
	
	// Log groups
	for (var leader in newGroups)
	{
		logInfo(newGroups[leader]);
	}

	// Check for ended groups
	for (var leader in status.groups) 
	{
		if (!(leader in newGroups)) {
			sendMessage(channelBotAlerts, `${leader}'s group is over.`)
		}
	}

	// Check for new and renamed groups
	for (var leader in newGroups)
	{
		var newGroup = newGroups[leader];
		if (!(leader in status.groups))
		{
			sendMessage(channelBotAlerts, `${leader} has started group '${newGroup.name}'. Group consists of ${newGroup.size} adventurers.`)
		} else {
			var oldGroup = status.groups[leader];
			if (oldGroup.name != newGroup.name)
			{
				sendMessage(channelBotAlerts, `${leader} has changed group name to '${newGroup.name}'`)
			}
			
			var oldSizeDivided = Math.floor(oldGroup.size / 4);
			var newSizeDivided = Math.floor(newGroup.size / 4);

			if (newSizeDivided > oldSizeDivided)
			{
				sendMessage(channelBotAlerts, `${leader}'s group has became bigger. Now it has ${newGroup.size} adventurers.`)
			}
			
			if (newSizeDivided < oldSizeDivided)
			{
				sendMessage(channelBotAlerts, `${leader}'s group has became smaller. Now it has ${newGroup.size} adventurers.`)
			}
		}
	}

	status.groups = newGroups;
}

function buildItemLink(name)
{
	return `[${name}](http://slothmudeq.ml/?search=${encodeURI(name)})`;
}

function reportNewItem(seller, name, price, buyout, ends)
{
	var link = buildItemLink(name);
	sendMessage(channelEmporium, `${seller} has put '${link}' on sale. Price/buyout is ${price}/${buyout}. The sale ends in ${ends}.`);
}

function reportSoldItem(seller, name, bidder, price)
{
	var link = buildItemLink(name);

	if (bidder.toLowerCase() == "nobody")
	{
		sendMessage(channelEmporium, `${seller}'s item '${link}' is no longer available for sale.`);
	} else
	{
		sendMessage(channelEmporium, `${seller}'s item '${link}' had been sold to ${bidder} for ${price}.`);
	}
}

function convertEndsToMinutes(ends)
{
	var minutesLeft = 0;

	try
	{
		var parts = ends.split(' ');
		for(var j = 0; j < parts.length; ++j)
		{
			var part = parts[j].trim();
			var re = /(\d+)(\w)/;
			var m = re.exec(part);
			if (m)
			{
				var value = parseInt(m[1]);
				if (m[2] == "d")
				{
					minutesLeft += 24 * 60 * value;
				} else if (m[2] == "h")
				{
					minutesLeft += 60 * value;
				} else if (m[2] == "m")
				{
					minutesLeft += value;
				}
			}
		}
		
		return minutesLeft;
	}
	catch (err)
	{
		logInfo(err);
	}
	
	return 0;
}


function processAuctions()
{
	logInfo("Checking auctions...");

	var data = loadPage("http://www.slothmud.org/wp/live-info/live-auctions");
	
	const dom = new JSDOM(data);
	var document = dom.window.document;
	
	var all = document.getElementsByTagName("tr");

	var count = 0;
	var newAuctions = {};
	for (var i=0; i < all.length; i++) 
	{
		var children = all[i].childNodes;

		if (children.length < 6)
		{
			continue;
		}

		var id = children[0].textContent;
		if (!isNumeric(id))
		{
			continue;
		}
		
		var name = children[1].textContent.trim();
		var seller = children[2].textContent.trim();
		var bidder = children[3].textContent.trim();
		var price = children[4].textContent.trim();
		var buyout = children[5].textContent.trim();
		var ends = children[6].textContent.trim();
		logInfo(`${id}, ${name}, ${seller}, ${price}, ${buyout}, ${ends}`);

		var item =
		{
			name: name,
			bidder: bidder,
			price: price,
			buyout: buyout,
			ends: ends,
			lastWarning: false
		};
		
		var sellerData;
		if (!(seller in newAuctions))
		{
			sellerData = [];
			newAuctions[seller] = sellerData;
		} else {
			sellerData = newAuctions[seller];
		}
		
		sellerData.push(item);
		++count;
	}
	
	logInfo(`Items count: ${count}`);
	
	if (!isEmpty(status.auctions))
	{
		for (var seller in newAuctions)
		{
			logInfo(`Going through items of ${seller}`);
			if (!(seller in status.auctions))
			{
				// New seller
				logInfo(`New seller`);
				// Report every item
				var sellerData = newAuctions[seller];
				for (var i = 0; i < sellerData.length; ++i)
				{
					var item = sellerData[i];
					reportNewItem(seller, item.name, item.price, item.buyout);
				}
			} else
			{
				// Remove existing items
				var newData = newAuctions[seller].slice();
				var oldData = status.auctions[seller];
				
				var newDataSameIndices = {};
				var oldDataSameIndices = {};
				
				for (var i = 0; i < newData.length; ++i)
				{
					var newItem = newData[i];
					for (var j = 0; j < oldData.length; ++j)
					{
						if (j in oldDataSameIndices)
						{
							continue;
						}
						
						var oldItem = oldData[j];
						if (newItem.name == oldItem.name)
						{
							// Mark item as same in both lists
							newDataSameIndices[i] = true;
							oldDataSameIndices[j] = true;
							
							if ("lastWarning" in oldItem)
							{
								newItem.lastWarning = oldItem.lastWarning;
							}
							break;
						}
					}
				}

				// Report remaining new items as put on sale
				for (var i = 0; i < newData.length; ++i)
				{
					// Last warning
					var item = newData[i];

					var minutesLeft = convertEndsToMinutes(item.ends);
					if (minutesLeft > 0 && minutesLeft <= 120 && !item.lastWarning)
					{
						var link = buildItemLink(item.name);
						sendMessage(channelEmporium, `The auction for ${seller}'s item '${link}' will end in less than two hours.`);
						item.lastWarning = true;
					}
					
					if (i in newDataSameIndices)
					{
						continue;
					}

					reportNewItem(seller, item.name, item.price, item.buyout, item.ends);
				}
				
				// Report remainng old items as sold
				for (var i = 0; i < oldData.length; ++i)
				{
					if (i in oldDataSameIndices)
					{
						continue;
					}
					
					var item = oldData[i];
					reportSoldItem(seller, item.name, item.bidder, item.price);
				}
			}
		}
		
		// Report items of disappeared sellers as sold
		for (var seller in status.auctions)
		{
			if (!(seller in newAuctions))
			{
				var items = status.auctions[seller];
				for (var i = 0; i < items.length; ++i)
				{
					var item = items[i];
					reportSoldItem(seller, item.name, item.bidder, item.price);
				}
			}
		}
	} else
	{
		logInfo("Existing auctions data is empty.");
	}

	status.auctions = newAuctions;
}

function processEpics()
{
	logInfo("Checking epics...");

	var data = loadPage("http://www.slothmud.org/support/mapserver2.php?filter=all");
	const dom = new JSDOM(data);
	var document = dom.window.document;

	var newEpics = [];
	var all = document.getElementsByTagName("div");
	for (var i=0; i < all.length; i++) 
	{
		var div = all[i];

		var area = div.getAttribute("area");
		var continent = div.getAttribute("continent");

		if (area == null || continent == null)
		{
			continue;
		}

		// Filter out non real epics
		if (continent.toLowerCase() == "godsland")
		{
			continue;
		}
		
		if (continent.toLowerCase() == "valkyre" && !area.toLowerCase().startsWith("dark"))
		{
			continue;
		}

		var name = div.textContent;
		
		logInfo(`${name}; ${area}; ${continent}`);
		
		var epic =
		{
			name: name,
			area: area,
			continent: continent
		}
		
		newEpics.push(epic);
	}

	if ("epics" in status)
	{
		// Report new epics
		for (var i = 0; i < newEpics.length; ++i)
		{
			var newEpic = newEpics[i];
			var found = false;
			for (var j = 0; j < status.epics.length; ++j)
			{
				var oldEpic = status.epics[j];
				
				if (newEpic.name == oldEpic.name)
				{
					found = true;
					break;
				}
			}
			
			if (!found)
			{
				sendMessage(channelEpics, `${newEpic.name} has appeared in ${newEpic.area} at ${newEpic.continent}.`);
			}
		}

		// Report killed epics
		for (var i = 0; i < status.epics.length; ++i)
		{
			var oldEpic = status.epics[i];
			var found = false;
			for (var j = 0; j < newEpics.length; ++j)
			{
				var newEpic = newEpics[j];
				
				if (newEpic.name == oldEpic.name)
				{
					found = true;
					break;
				}
			}
			
			if (!found)
			{
				sendMessage(channelEpics, `${oldEpic.name} is no more.`);
			}
		}
	}

	status.epics = newEpics;
}