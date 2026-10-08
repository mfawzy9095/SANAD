'use strict';
// System UI traversal order differs by Android version. Match the visible header row.
function notificationExpand(nodes,titleText){
 const bounds=n=>{const m=n?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);return m&&m.slice(1).map(Number);};
 const title=bounds(nodes.find(n=>n.includes('text="'+titleText+'"')));
 if(!title)return;
 const y=(title[1]+title[3])/2;
 const matches=nodes.filter(n=>{const b=bounds(n);return b&&n.includes(':id/expand_button"')&&n.includes('clickable="true"')&&b[1]<=y&&b[3]>=y;});
 return matches.length===1?matches[0]:undefined;
}
module.exports={notificationExpand};
