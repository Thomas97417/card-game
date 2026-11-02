import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {FOUNDRY_GOLEMS, type FoundryGolemId} from '@sylve/game/foundry';

export interface FoundryGolemArt {
  root:THREE.Group; damage:THREE.Group;
  animate(seconds:number,motion?:{speed:number;phase:number;raging:boolean;stolen:number}):void;
}

/** Ten articulated constructs share their sculpted primitives and brushed materials. */
export function createFoundryGolemArt(mobile:boolean) {
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const own=<T extends THREE.BufferGeometry>(geometry:T)=>{geometries.push(geometry);return geometry;};
  const sphere=own(new THREE.SphereGeometry(1,mobile?16:24,mobile?10:16));
  const box=own(new RoundedBoxGeometry(1,1,1,mobile?1:2,.1));
  const facet=own(new THREE.DodecahedronGeometry(1));
  const gem=own(new THREE.OctahedronGeometry(1));
  const spike=own(new THREE.ConeGeometry(1,1,5));
  const cylinder=own(new THREE.CylinderGeometry(1,1,1,12));
  const ring=own(new THREE.TorusGeometry(1,.13,6,20));
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(-.7,.6,0,1.3);shape.quadraticCurveTo(.7,.6,0,0);
  const leaf=own(new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:true,bevelSegments:1,bevelSize:.03,bevelThickness:.02,steps:1,curveSegments:8}));
  const noise=new Uint8Array(32*32*4);
  for(let i=0;i<32*32;i++){const value=218+Math.round((Math.sin(i*17.13)+Math.sin(i*.31))*15);noise.set([value,value,value,255],i*4);}
  const grain=new THREE.DataTexture(noise,32,32);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.needsUpdate=true;
  function material(color:number,metalness=.25,emissive=0){const mat=new THREE.MeshStandardMaterial({color,metalness,roughness:.72,map:grain,bumpMap:grain,bumpScale:metalness?.012:.025,emissive,emissiveIntensity:emissive?.8:0});materials.push(mat);return mat;}
  const copper=material(0xb77a43),gold=material(0xe2b365),iron=material(0x343e3b),wood=material(0x745031,0),leather=material(0x3b3025,0),stone=material(0x747a70,0),green=material(0x47785d,.1),silver=material(0x9ba9aa,.4);
  const turquoise=material(0x80dcc4,.1,0x3d9f91),jade=material(0x79cc8e,.1,0x42995b),amber=material(0xe6b44c,.12,0x995517),fire=material(0xffb35b,.1,0xf56b28),dark=material(0x152721,0);
  const shellAmber=material(0xcb8b35,.12);shellAmber.transparent=true;shellAmber.opacity=.88;
  const shells:Record<FoundryGolemId,THREE.Material>={copper,sap:wood,stone,amber:shellAmber,ember:iron,shrapnel:silver,furnace:iron,thorn:stone,thief:green,reinforcement:copper};
  const cores:Record<FoundryGolemId,THREE.Material>={copper:turquoise,sap:jade,stone:turquoise,amber,ember:fire,shrapnel:turquoise,furnace:fire,thorn:jade,thief:amber,reinforcement:turquoise};
  function mesh(geometry:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const crack=own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.1,.19,.3),new THREE.Vector3(.02,.08,.34),new THREE.Vector3(-.05,-.04,.35),new THREE.Vector3(.1,-.2,.3)]),8,.009,4,false));
  function create(id:FoundryGolemId):FoundryGolemArt {
    const spec=FOUNDRY_GOLEMS[id],root=new THREE.Group();root.name=`foundry-golem-${id}`;
    const heavy=['stone','thorn','furnace','reinforcement'].includes(id), width=id==='thief'?.28:id==='reinforcement'?.37:heavy?.4:.33;
    const torso=new THREE.Group();torso.name='golem-torso';torso.position.y=.59;root.add(torso);
    mesh(id==='stone'||id==='amber'?facet:sphere,shells[id],torso,0,0,0,width,.34,.28);
    mesh(box,iron,torso,0,-.24,0,.38,.11,.28);
    const chest=mesh(ring,gold,torso,0,.01,.26,.18,.18,.13);
    mesh(sphere,cores[id],torso,0,.01,.3,.145,.17,.075);
    const core=mesh(gem,cores[id],torso,0,.01,.35,.145,.18,.11);core.rotation.y=Math.PI/4;
    mesh(cylinder,id==='sap'||id==='copper'?wood:iron,root,0,.9,0,.12,.16,.12);
    const head=new THREE.Group();head.position.set(0,1.02,.02);root.add(head);
    mesh(id==='stone'?box:sphere,shells[id],head,0,0,0,.22,.19,.2);
    mesh(box,dark,head,0,-.01,.18,.31,.08,.035);
    for(const side of [-1,1]){mesh(ring,id==='stone'?iron:gold,head,side*.075,-.005,.2,.054,.054,.03);mesh(sphere,cores[id],head,side*.075,-.005,.217,.038,.04,.025);}
    mesh(box,iron,head,0,-.11,.166,.07,.014,.017);
    const arms:THREE.Group[]=[],legs:THREE.Group[]=[];
    for(const side of [-1,1]) {
      const arm=new THREE.Group();arm.position.set(side*(width+.075),.73,0);root.add(arm);arms.push(arm);
      mesh(sphere,heavy?iron:gold,arm,0,0,0,.105);
      mesh(box,shells[id],arm,0,-.16,0,heavy?.19:.14,.25,.16);
      mesh(sphere,shells[id],arm,0,-.32,.025,heavy?.13:.1,.12,.115);
      const leg=new THREE.Group();leg.name=side<0?'golem-left-leg':'golem-right-leg';leg.position.set(side*.18,.3,0);root.add(leg);legs.push(leg);
      mesh(cylinder,iron,leg,0,-.08,0,.065,.21,.065);
      mesh(box,shells[id],leg,0,-.11,0,.12,.16,.13);
      mesh(box,heavy?iron:copper,leg,0,-.23,.07,heavy?.24:.19,.13,.28);
      mesh(sphere,gold,torso,side*.23,.18,.19,.026);
      const pin=mesh(cylinder,gold,arm,0,-.07,.09,.04,.025,.04);pin.rotation.x=Math.PI/2;
    }
    if(id==='sap')for(const [x,y,angle] of [[-.08,1.17,.5],[.05,1.17,-.5],[0,1.19,0]]){const l=mesh(leaf,green,root,x!,y!,0,.14,.2,.15);l.rotation.z=angle!;}
    if(id==='copper'){const l=mesh(leaf,gold,head,0,.1,.13,.07,.12,.08);l.rotation.z=.15;}
    if(id==='stone')for(const side of [-1,1])mesh(box,stone,torso,side*.35,.18,0,.25,.2,.36);
    if(id==='amber')for(const side of [-1,1]){const plate=mesh(facet,shellAmber,torso,side*.25,.1,.02,.15,.25,.24);plate.rotation.z=side*.25;}
    if(id==='ember')for(const side of [-1,1]){const horn=mesh(spike,copper,head,side*.18,.12,.02,.07,.27,.07);horn.rotation.z=-side*.6;mesh(box,fire,torso,side*.23,.03,.19,.035,.32,.035);mesh(box,fire,arms[side<0?0:1]!,0,-.2,.085,.11,.028,.025);}
    if(id==='shrapnel')for(const side of [-1,1])for(const back of [-1,1]){const shard=mesh(gem,silver,torso,side*.34,.25,back*.15,.08,.2,.08);shard.rotation.z=-side*.5;}
    if(id==='furnace')for(const side of [-1,1]){mesh(cylinder,copper,root,side*.2,1.05,-.2,.07,.55,.07);mesh(cylinder,dark,root,side*.2,1.333,-.2,.055,.012,.055);mesh(box,fire,torso,side*.23,0,.2,.04,.35,.03);}
    if(id==='thorn')for(let i=0;i<8;i++){const angle=i*Math.PI/4;const thorn=mesh(spike,copper,torso,Math.cos(angle)*.38,.1+Math.sin(angle)*.1,Math.sin(angle)*.22,.07,.23,.07);thorn.rotation.z=-Math.cos(angle)*1.15;thorn.rotation.x=Math.sin(angle)*1.15;}
    const coins=new THREE.Group();coins.visible=false;root.add(coins);
    if(id==='thief') {
      const hood=mesh(spike,green,head,0,.2,-.04,.22,.25,.2);hood.rotation.z=-.15;
      mesh(box,leather,root,.32,.39,-.03,.22,.25,.2);mesh(box,gold,root,.32,.42,.08,.07,.06,.025);
      for(let i=0;i<3;i++){const coin=mesh(cylinder,gold,coins,.28+i*.035,.55+i*.02,-.02,.07,.02,.07);coin.rotation.z=i*.2;}
    }
    if(id==='reinforcement'){for(const x of [-.12,0,.12])mesh(box,copper,head,x,.22,-.01,.075,.2,.17);mesh(box,copper,torso,0,-.13,.23,.3,.15,.1);}
    const damage=new THREE.Group();torso.add(damage);damage.visible=false;mesh(crack,dark,damage,0,0,0,1);const other=mesh(crack,dark,damage,.1,-.04,-.01,.7);other.rotation.z=.5;
    return {root,damage,animate(time,motion){
      const moving=motion?Math.min(1,motion.speed/spec.speed):0, raging=!!motion?.raging;
      const frequency=spec.gait==='stomp'||spec.gait==='waddle'?4:spec.gait==='skitter'?14:spec.gait==='prowl'?11:raging?13:8;
      const phase=time*frequency+(motion?.phase??0), stride=Math.sin(phase)*moving;
      const hop=spec.gait==='hop'?Math.max(0,Math.sin(phase))*.085*moving:spec.gait==='skitter'?Math.max(0,Math.sin(phase))*.04*moving:Math.abs(stride)*.016;
      torso.position.y=.59+hop;head.position.y=1.02+hop;
      torso.rotation.z=stride*(spec.gait==='waddle'?.11:spec.gait==='skitter'?.07:.035);head.rotation.z=-torso.rotation.z*.5;
      torso.rotation.x=raging?.18:spec.gait==='prowl'?.1:0;
      for(let i=0;i<2;i++){const side=i===0?1:-1;legs[i]!.rotation.x=side*stride*(heavy?.28:.55);arms[i]!.rotation.x=-side*stride*(raging?.8:.4);}
      const pulse=1+Math.sin(time*(raging?12:3))*.035;core.scale.set(.145*pulse*(raging?1.2:1),.18*pulse,.11);chest.rotation.z=Math.sin(time)*.015;
      coins.visible=(motion?.stolen??0)>0;coins.scale.setScalar(1+Math.min(1,(motion?.stolen??0)/100)*.25);
    }};
  }
  function bomb(){const root=new THREE.Group();mesh(facet,iron,root,0,.16,0,.22,.16,.22);mesh(gem,fire,root,0,.23,0,.12,.19,.12);const halo=mesh(ring,amber,root,0,.05,0,.25);halo.rotation.x=-Math.PI/2;return root;}
  function shard(){return new THREE.Mesh(gem,silver);}
  return {create,bomb,shard,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());grain.dispose();}};
}
