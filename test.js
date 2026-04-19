const fs = require('fs');
const content = fs.readFileSync('appscript/Code.gs', 'utf8');
const matches = [...content.matchAll(/['"]projects['"]/gi)];
console.log(matches.map(m => m[0]));
