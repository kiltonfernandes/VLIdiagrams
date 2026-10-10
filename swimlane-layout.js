// A shared time axis, with one horizontal band per participant. No compound
// graph is sent to ELK: a handoff changes the band, not the whole group order.
export function layoutSwimlanes(elements, offset={x:60,y:70}, reverse=false) {
  const nodes=elements.filter(e=>e.type==='shape'), lanes=elements.filter(e=>e.type==='lane');
  const byId=new Map(nodes.map(e=>[e.id,e]));
  const links=elements.filter(e=>e.type==='connector'&&byId.has(e.from)&&byId.has(e.to));
  const outgoing=new Map(nodes.map(e=>[e.id,[]])), incoming=new Map(nodes.map(e=>[e.id,[]]));
  for(const edge of links){outgoing.get(edge.from).push(edge);incoming.get(edge.to).push(edge);delete edge.route;}
  const negative=text=>/^(não|nao|no|false|erro|falha)$/i.test(String(text||'').trim());
  const rows=new Map(nodes.map(n=>[n.id,0]));
  // Put terminating side branches below the successful path. A branch which
  // returns to the main path retains row zero, so joins and loops stay legible.
  for(const decision of nodes.filter(n=>n.shape==='decision')) {
    const branches=outgoing.get(decision.id), yes=branches.find(e=>!negative(e.text));
    if(!yes)continue;
    const reachable=new Set(), queue=[yes.to];
    while(queue.length){const id=queue.shift();if(id===decision.id||reachable.has(id))continue;reachable.add(id);for(const edge of outgoing.get(id)||[])queue.push(edge.to);}
    const continuesInLane=[...reachable].some(id=>byId.get(id).laneId===decision.laneId);
    if(!continuesInLane)continue;
    for(const branch of branches.filter(e=>negative(e.text))) {
      const visited=new Set(), pending=[branch.to];
      while(pending.length){const id=pending.shift();if(id===decision.id||reachable.has(id)||visited.has(id))continue;visited.add(id);const node=byId.get(id);if(node.laneId===decision.laneId)rows.set(id,1);for(const edge of outgoing.get(id)||[])pending.push(edge.to);}
    }
  }
  // Kahn ordering with deterministic cycle cuts. Back edges are routed later;
  // they never cause an unbounded rank calculation.
  const pending=new Set(nodes.map(n=>n.id)), ranks=new Map(), occupied=new Map();
  const indegrees=new Map(nodes.map(n=>[n.id,incoming.get(n.id).filter(e=>e.from!==n.id).length]));
  while(pending.size) {
    let next=nodes.find(n=>pending.has(n.id)&&indegrees.get(n.id)===0);
    if(!next)next=nodes.find(n=>pending.has(n.id));
    let rank=0;
    for(const edge of incoming.get(next.id)) {
      if(!ranks.has(edge.from))continue;
      const from=byId.get(edge.from);
      const advances=from.laneId===next.laneId&&rows.get(from.id)===rows.get(next.id);
      rank=Math.max(rank,ranks.get(from.id)+(advances?1:0));
    }
    const rowKey=(next.laneId||'free')+':'+rows.get(next.id);
    if(!occupied.has(rowKey))occupied.set(rowKey,new Set());
    while(occupied.get(rowKey).has(rank))rank++;
    occupied.get(rowKey).add(rank);ranks.set(next.id,rank);pending.delete(next.id);
    for(const edge of outgoing.get(next.id))if(pending.has(edge.to)&&edge.to!==next.id)indegrees.set(edge.to,Math.max(0,indegrees.get(edge.to)-1));
  }
  const maxRank=Math.max(0,...ranks.values()), widths=Array(maxRank+1).fill(180);
  for(const node of nodes)widths[ranks.get(node.id)]=Math.max(widths[ranks.get(node.id)],node.width||180);
  const columns=[], left=offset.x+36;
  let cursor=left;
  for(const width of widths){columns.push(cursor+width/2);cursor+=width+72;}
  const laneWidth=cursor-offset.x-72+36;
  let top=offset.y;
  const placeBand=(lane,members)=>{
    const rowCount=Math.max(1,...members.map(n=>rows.get(n.id)+1));
    const heights=Array(rowCount).fill(70);
    for(const node of members)heights[rows.get(node.id)]=Math.max(heights[rows.get(node.id)],node.height||80);
    const centers=[];let rowY=top+58;
    for(const height of heights){centers.push(rowY+height/2);rowY+=height+44;}
    if(lane){lane.x=offset.x;lane.y=top;lane.width=laneWidth;lane.height=rowY-top-44+34;lane.layout='swimlane';}
    for(const node of members){const cx=columns[ranks.get(node.id)];node.x=(reverse?offset.x+laneWidth-(cx-offset.x):cx)-(node.width||180)/2;node.y=centers[rows.get(node.id)]-(node.height||80)/2;}
    top=rowY-44+34+20;
  };
  for(const lane of lanes)placeBand(lane,nodes.filter(n=>n.laneId===lane.id));
  const free=nodes.filter(n=>!lanes.some(l=>l.id===n.laneId));
  if(free.length)placeBand(null,free);
  return elements;
}
