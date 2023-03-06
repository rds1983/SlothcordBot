const Discord = require("discord.js")
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const { Client, Events, GatewayIntentBits } = require('discord.js');

let config = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

var channel;
var groups = {};

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
  for(var leader in groups) 
  {
    if (!(leader in newGroups)) {
        channel.send (`${leader}'s group has ended.`)
    }
  }

  // Check for new and renamed groups
  for(var leader in newGroups)
  {
      var groupName = newGroups[leader];
      if(!(leader in groups))
      {
        channel.send(`${leader} has started group '${groupName}'`)
      } else if (groups[leader] != newGroups[leader])
      {
        channel.send(`${leader} has changed group name to '${groupName}'`)
      }         
  }

  groups = newGroups;
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

