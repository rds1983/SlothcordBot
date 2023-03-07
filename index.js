const statusFileName = "status.json";
const checkIntervalInMs = 5 * 60 * 1000 // 5 minutes

const Discord = require("discord.js")
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

var channel;

var status = {};
status.groups = {};
status.auctions = {};

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
		if (m) {
			var leader = m[1];
			var groupName = m[2];

			newGroups[leader] = groupName;
			logInfo(`${leader}, ${groupName}`);
		}
	} while (m);

	// Check for ended groups
	for (var leader in status.groups) 
	{
		if (!(leader in newGroups)) {
			channel.send (`${leader}'s group has ended.`)
		}
	}

	// Check for new and renamed groups
	for (var leader in newGroups)
	{
		var groupName = newGroups[leader];
		if (!(leader in status.groups))
		{
			channel.send(`${leader} has started group '${groupName}'`)
		} else if (status.groups[leader] != newGroups[leader])
		{
			channel.send(`${leader} has changed group name to '${groupName}'`)
		}
	}

	status.groups = newGroups;
}

function reportNewItem(seller, name, price, buyout)
{
	var s = `${seller} has put '${name}' for sale. Price: ${price}. Buyout: ${buyout}`;
	logInfo (s);
	channel.send(`${seller} has put '${name}' for sale. Price: ${price}. Buyout: ${buyout}`);
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
	for (var i=0, max=all.length; i < max; i++) 
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
		
		var name = children[1].textContent;
		var seller = children[2].textContent;
		var price = children[4].textContent;
		var buyout = children[5].textContent;
		logInfo(`${id}, ${name}, ${seller}, ${price}, ${buyout}`);
		
		var item =
		{
			name: name,
			price: price,
			buyout: buyout
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
							break;
						}
					}
				}

				// Now report remaining ones
				for (var i = 0; i < newData.length; ++i)
				{
					if (i in newDataSameIndices)
					{
						continue;
					}
					
					var item = newData[i];
					
					reportNewItem(seller, item.name, item.price, item.buyout);
				}
			}
		}
	} else
	{
		logInfo("Existing auctions data is empty.");
	}

	status.auctions = newAuctions;
}
