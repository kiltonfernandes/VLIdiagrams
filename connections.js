import { geometryKey } from "./layout.js";
function connectionPoint(item,side){
  const x=item.x,y=item.y,w=item.width||220,h=item.height||190;
  if(item.shape==="decision"){
    const insetX=w*.14,insetY=h*.14;
    const extent=Math.min(w*.6,h*.72)/Math.SQRT2;
    if(side==="top")return{x:x+w/2,y:y+h/2-extent};
    if(side==="bottom")return{x:x+w/2,y:y+h/2+extent};
    if(side==="left")return{x:x+w/2-extent,y:y+h/2};
    return{x:x+w/2+extent,y:y+h/2};
  }
  if(side==="top")return{x:x+w/2,y};
  if(side==="bottom")return{x:x+w/2,y:y+h};
  if(side==="left")return{x,y:y+h/2};
  return{x:x+w,y:y+h/2};
}
export function routeConnection(line,d,key=geometryKey(d.elements)){
  const a=d.elements.find(e=>e.id===line.from),b=d.elements.find(e=>e.id===line.to);
  if(!a||!b)return null;
  if (line.route?.key === key && line.route.points?.length > 1) {
    const pts = line.route.points.map(p => ({...p}));
    // Attach the saved orthogonal route to the visible decision diamond.
    for (const item of [a,b]) {
      if (item.shape !== "decision") continue;
      const at=item===a?0:pts.length-1,next=item===a?1:pts.length-2;
      const p=pts[at],q=pts[next],vertical=Math.abs(p.x-q.x)<.5;
      const side=vertical?(p.y<item.y+item.height/2?"top":"bottom"):(p.x<item.x+item.width/2?"left":"right");
      const tip=connectionPoint(item,side);
      const elbow=vertical?{x:tip.x,y:p.y}:{x:p.x,y:tip.y};
      if(at===0)pts.splice(0,1,tip,elbow,p);else pts.splice(pts.length-1,1,p,elbow,tip);
    }
    const midpoint=pts[Math.floor(pts.length/2)];
    return {dPath:pts.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" "),label:line.route.label||{...midpoint,anchor:"middle"}};
  }
  const center=e=>({x:e.x+(e.width||220)/2,y:e.y+(e.height||190)/2});
  const ca=center(a),cb=center(b),sides=["top","right","bottom","left"];
  const vector={top:{x:0,y:-1},right:{x:1,y:0},bottom:{x:0,y:1},left:{x:-1,y:0}};
  const obstacles=d.elements.filter(e=>e.id!==a.id&&e.id!==b.id&&e.type!=="connector"&&e.type!=="lane");
  const stub=24;
  const compact=points=>{
    const unique=points.filter((p,i)=>i===0||Math.abs(p.x-points[i-1].x)>.5||Math.abs(p.y-points[i-1].y)>.5);
    return unique.filter((p,i,all)=>i===0||i===all.length-1||!((Math.abs(p.x-all[i-1].x)<.5&&Math.abs(p.x-all[i+1].x)<.5)||(Math.abs(p.y-all[i-1].y)<.5&&Math.abs(p.y-all[i+1].y)<.5)));
  };
  const blocked=(p1,p2,o)=>{
    const pad=12,left=o.x-pad,right=o.x+(o.width||220)+pad,top=o.y-pad,bottom=o.y+(o.height||190)+pad;
    if(Math.abs(p1.y-p2.y)<.5)return p1.y>top&&p1.y<bottom&&Math.max(Math.min(p1.x,p2.x),left)<Math.min(Math.max(p1.x,p2.x),right);
    if(Math.abs(p1.x-p2.x)<.5)return p1.x>left&&p1.x<right&&Math.max(Math.min(p1.y,p2.y),top)<Math.min(Math.max(p1.y,p2.y),bottom);
    return true;
  };
  const length=pts=>pts.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-pts[i].x)+Math.abs(p.y-pts[i].y),0);
  let best=null;
  for(const fromSide of sides)for(const toSide of sides)for(const horizontalFirst of [true,false]){
    const start=connectionPoint(a,fromSide),end=connectionPoint(b,toSide);
    const p1={x:start.x+vector[fromSide].x*stub,y:start.y+vector[fromSide].y*stub};
    const p4={x:end.x+vector[toSide].x*stub,y:end.y+vector[toSide].y*stub};
    const bend=horizontalFirst?{x:p4.x,y:p1.y}:{x:p1.x,y:p4.y};
    const pts=compact([start,p1,bend,p4,end]);
    let collisions=0;
    for(let i=1;i<pts.length;i++)for(const obstacle of obstacles)if(blocked(pts[i-1],pts[i],obstacle))collisions++;
    const toward={x:cb.x-ca.x,y:cb.y-ca.y};
    const sourceDot=vector[fromSide].x*toward.x+vector[fromSide].y*toward.y;
    const targetDot=vector[toSide].x*(-toward.x)+vector[toSide].y*(-toward.y);
    const directionPenalty=(sourceDot<0?1:0)+(targetDot<0?1:0);
    const score=collisions*100000+directionPenalty*900+length(pts)+Math.max(0,pts.length-2)*7;
    if(!best||score<best.score)best={pts,score};
  }
  if(!best)return null;
  const dPath=best.pts.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");
  let label=null,maxLength=-1;
  for(let i=1;i<best.pts.length;i++){
    const p1=best.pts[i-1],p2=best.pts[i],segLength=Math.abs(p2.x-p1.x)+Math.abs(p2.y-p1.y);
    if(segLength>maxLength){maxLength=segLength;label={x:(p1.x+p2.x)/2+(Math.abs(p1.x-p2.x)<1?8:0),y:(p1.y+p2.y)/2-(Math.abs(p1.y-p2.y)<1?8:0),anchor:Math.abs(p1.x-p2.x)<1?"start":"middle"};}
  }
  return{dPath,label};
}
