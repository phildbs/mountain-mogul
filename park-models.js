/* Mountain Mogul freestyle models — shared by the game and the independent model viewer.
   Geometry only; no simulation, placement or save logic. */
(function(){
  const snow=new THREE.MeshLambertMaterial({color:0xeaf5fb,side:THREE.DoubleSide});
  const snowSide=new THREE.MeshLambertMaterial({color:0xc7deea,side:THREE.DoubleSide});
  const steel=new THREE.MeshLambertMaterial({color:0x667b8a,metalness:0.25});
  const bright=new THREE.MeshLambertMaterial({color:0xd9e3e9,metalness:0.3});
  const navy=new THREE.MeshLambertMaterial({color:0x304a5d});
  const orange=new THREE.MeshLambertMaterial({color:0xf4a94e});
  const teal=new THREE.MeshLambertMaterial({color:0x42b6b4});
  function mesh(root, geo, mat, x=0,y=0,z=0) {
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  }
  function beam(root,a,b,r,mat=steel) {
    const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(v2,v1);
    const m=mesh(root,new THREE.CylinderGeometry(r,r,d.length(),10),mat,...v1.clone().add(v2).multiplyScalar(.5).toArray());
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
  }
  function snowform(root,width,profile) {
    const v=[],ix=[],n=profile.length;
    for(const x of [-width/2,width/2]) for(const [z,y] of profile) v.push(x,y,z);
    for(let i=0;i<n-1;i++){
      let a=i,b=i+1,c=i+n,d=i+1+n;
      ix.push(a,c,b,b,c,d);
    }
    // Closed left/right walls give the snow shapes real depth, not paper-thin planes.
    for(const side of [0,n]){
      for(let i=1;i<n-1;i++)ix.push(side,side+i,side+i+1);
    }
    ix.push(0,n,1,1,n,n+1,n-1,n*2-1,n-2,n-2,n*2-1,n*2-2);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(ix);geo.computeVertexNormals();
    mesh(root,geo,snow);
    // Side rails are lightweight colored edges to reveal the shape from game camera height.
    for(const x of [-width/2,width/2]){
      for(let i=0;i<n-1;i++) {
        const p=profile[i],q=profile[i+1];beam(root,[x,p[1]+.035,p[0]],[x,q[1]+.035,q[0]],.027,snowSide);
      }
    }
  }
  function rail(root,curve,r=.062,mat=bright){
    mesh(root,new THREE.TubeGeometry(curve,40,r,9,false),mat);
  }
  function marking(root,z,width,y,color=orange){
    mesh(root,new THREE.BoxGeometry(width,.025,.12),color,0,y,z);
  }
  window.createParkFeatureModel=function(type){
    const g=new THREE.Group();
    if(type==='roller'){
      const p=[];for(let i=0;i<=14;i++){const z=-.9+i*1.8/14;const y=.03+.36*Math.pow(Math.max(0,1-Math.pow(z/.9,2)),2);p.push([z,y]);}
      snowform(g,1.9,p);
      marking(g,-.43,1.6,.16,teal);
    }else if(type==='jump'){
      // Sculpted kicker: smoothly rising takeoff lip rather than an angled block.
      snowform(g,2.2,[[-1.5,.03],[-1.25,.05],[-1,.10],[-.72,.22],[-.44,.42],[-.18,.67],[.08,.87],[.34,.94],[.48,.93],[.68,.65],[.96,.19],[1.23,.04]]);
      marking(g,.25,1.8,.95,orange);
    }else if(type==='tabletop'){
      // Broad approach, genuinely flat tabletop and smooth backside landing.
      snowform(g,3.4,[[-2.6,.03],[-2.25,.10],[-1.85,.32],[-1.35,.83],[-.9,1.23],[-.45,1.38],[.55,1.38],[1.1,1.36],[1.55,1.15],[2,.66],[2.48,.10],[2.7,.03]]);
      marking(g,-.48,3,.1+1.28,teal);marking(g,.58,3,1.4,orange);
    }else if(type==='box'){
      // Long, clean slide face with contrasting sides and rounded-end visual details.
      mesh(g,new THREE.BoxGeometry(1.25,.29,2.75),navy,0,.5,0);
      mesh(g,new THREE.BoxGeometry(1.28,.055,2.73),bright,0,.68,0);
      for(const x of [-.55,.55]) {
        mesh(g,new THREE.BoxGeometry(.065,.09,2.55),teal,x,.70,0);
        for(const z of [-.85,.85])beam(g,[x,.34,z],[x,.06,z],.052,steel);
      }
      for(const z of [-1.12,1.12])mesh(g,new THREE.BoxGeometry(.85,.19,.12),orange,0,.5,z);
    }else if(type==='rail'||type==='rainbow'){
      const raised=type==='rainbow';
      const points=[];
      for(let i=0;i<=24;i++){
        const z=-1.52+i*3.04/24;
        const y=raised?.65+.52*Math.max(0,1-Math.pow(z/1.52,2)):.72;
        points.push(new THREE.Vector3(0,y,z));
      }
      const curve=new THREE.CatmullRomCurve3(points);
      rail(g,curve,.075,bright);
      for(const z of [-1.15,0,1.15]){
        const y=raised?.65+.52*Math.max(0,1-Math.pow(z/1.52,2)):.72;
        beam(g,[0,.07,z],[0,y-.07,z],.052,steel);
        mesh(g,new THREE.CylinderGeometry(.22,.25,.07,12),navy,0,.065,z);
      }
      for(const z of [-1.42,1.42])mesh(g,new THREE.BoxGeometry(.19,.10,.13),orange,0,raised?.72:.72,z);
    }
    return g;
  };
})();