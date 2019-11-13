// const Agent = require('./agent');
AgentBase = require('./AgentBase')
const VERSION = 7;


// agentA = new Agent();
agentB = new AgentBase('TeamA', {x: -15, y: 15});

// require('./socket')(agentA, 'TeamA', VERSION);
// require('./socket')(agentB, 'TeamB', VERSION);

// agentA.socketSend("move", '-15 0');
// agentB.socketSend("move", '-15 0');
