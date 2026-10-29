"""Reproducible Blender 4.2 asset authoring. Run with blender -b --python this_file.
Coordinates below use the game's x/y(up)/z convention; meshes are converted to Blender Z-up.
The photograph informs architectural features, not pasted imagery or copied shop branding.
"""
import bpy, math, random, json, os, sys
from pathlib import Path
from mathutils import Vector
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'; OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'assets/blender'
random.seed(27)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
layout=json.loads((ROOT/'lib/town/layout.json').read_text())

def rgba(hexcode):
 h=hexcode.lstrip('#');values=[int(h[i:i+2],16)/255 for i in (0,2,4)];return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)
def material(name,color,rough=.75,metal=0,texture=None,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=rgba(color);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=rgba(color);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 if emission:bs.inputs['Emission Color'].default_value=rgba(color);bs.inputs['Emission Strength'].default_value=emission
 if texture:
  n=256;y,x=np.mgrid[0:n,0:n].astype(float)/n;rng=np.random.default_rng(14)
  if texture=='wood':field=.92+.10*np.sin(x*140+np.sin(y*12)*1.2)+.04*np.sin(x*520+np.sin(y*21)*3)+rng.normal(0,.025,(n,n))
  else:field=.92+rng.normal(0,.065,(n,n))+.04*np.sin(x*42)*np.cos(y*27)
  pixels=np.ones((n,n,4),dtype=np.float32);pixels[:,:,:3]=np.clip(np.array(rgba(color)[:3])[None,None,:]*field[:,:,None],0,1)
  img=bpy.data.images.new(name+'_albedo',width=n,height=n);img.pixels.foreach_set(pixels.ravel());img.pack()
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 return m
M={
 'cedar':material('Aged cedar | grain','#65442c',.79,texture='wood'),
 'darkwood':material('Smoked structural timber','#342c24',.86,texture='wood'),
 'lightwood':material('Honey oak shop joinery','#a7804d',.7,texture='wood'),
 'plaster':material('Lime plaster | warm ivory','#ddd7ba',.95,texture='stone'),
 'ochre':material('Ochre earthen wall','#bfa36b',.97,texture='stone'),
 'tile':material('Kawara | blue charcoal','#4e5960',.65,texture='stone'),
 'tilelight':material('Kawara | weathered edge','#69767b',.65),
 'tiledeep':material('Kawara | shadow seam','#303b41',.8),
 'stone':material('Cut granite','#a4a7a0',.95,texture='stone'),
 'stonewarm':material('Warm paving stone','#bbb8a9',.94,texture='stone'),
 'stonedark':material('Dark paving stone','#919a98',.96,texture='stone'),
 'glass':material('Old glass | blue reflection','#738f96',.24,.25),
 'indigo':material('Indigo noren','#263b53',.95),
 'green':material('Tea green noren','#51573b',.98),
 'rust':material('Oxide red noren','#854737',.96),
 'paper':material('Washi lantern','#edcf98',.85,emission=.16),
 'iron':material('Patinated iron','#344346',.48,.65),
 'brass':material('Lantern brass','#b69855',.38,.6),
 'leaf':material('Camellia foliage','#3f6542',.96),
 'leaflight':material('Sunlit foliage','#5d8050',.96),
 'earth':material('Garden earth','#6f7659',1),
 'red':material('Shrine vermilion','#9b4934',.74),
 'hill':material('Distant forest ridge','#526e60',1),
 'water':material('River jade','#4f9092',.22,.18),
}
class Mesh:
 def __init__(self,name):self.name=name;self.v=[];self.f=[];self.mi=[];self.uv=[];self.keys=[]
 def face(self,verts,mat,uv=None):
  start=len(self.v);self.v.extend(verts);self.f.append(tuple(range(start,start+len(verts))));self.mi.append(self.keys.index(mat) if mat in self.keys else len(self.keys))
  if mat not in self.keys:self.keys.append(mat)
  self.uv.extend(uv or [(0,0),(1,0),(1,1),(0,1)][:len(verts)])
 def box(self,x,y,z,w,h,d,mat):
  a,b,c=x-w/2,y-h/2,z-d/2;A,B,C=x+w/2,y+h/2,z+d/2
  for face in [[(a,b,C),(A,b,C),(A,B,C),(a,B,C)],[(A,b,c),(a,b,c),(a,B,c),(A,B,c)],[(a,b,c),(a,b,C),(a,B,C),(a,B,c)],[(A,b,C),(A,b,c),(A,B,c),(A,B,C)],[(a,B,C),(A,B,C),(A,B,c),(a,B,c)],[(a,b,c),(A,b,c),(A,b,C),(a,b,C)]]:self.face(face,mat)
 def rod(self,p,q,r,mat,n=8,r2=None):
  p,q=Vector(p),Vector(q);axis=(q-p).normalized();side=axis.cross(Vector((0,1,0)))
  if side.length<.01:side=axis.cross(Vector((1,0,0)))
  side.normalize();up=axis.cross(side).normalized();r2=r if r2 is None else r2
  ring1=[p+(side*math.cos(i*math.tau/n)+up*math.sin(i*math.tau/n))*r for i in range(n)]
  ring2=[q+(side*math.cos(i*math.tau/n)+up*math.sin(i*math.tau/n))*r2 for i in range(n)]
  for i in range(n):j=(i+1)%n;self.face([ring1[i],ring1[j],ring2[j],ring2[i]],mat)
  for i in range(1,n-1):self.face([ring1[0],ring1[i+1],ring1[i]],mat);self.face([ring2[0],ring2[i],ring2[i+1]],mat)
 def finish(self,parent=None):
  mesh=bpy.data.meshes.new(self.name);mesh.from_pydata([(v[0],-v[2],v[1]) for v in self.v],[],self.f);mesh.update()
  for key in self.keys:mesh.materials.append(M[key])
  for p,i in zip(mesh.polygons,self.mi):p.material_index=i
  uv=mesh.uv_layers.new(name='UVMap');uv.data.foreach_set('uv',[v for pair in self.uv for v in pair])
  obj=bpy.data.objects.new(self.name,mesh);bpy.context.collection.objects.link(obj)
  if parent:obj.parent=parent
  return obj

def group(name):
 g=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(g);return g

def roof(mesh,w,depth,ridge,slope,frontonly=False):
 sides=[1] if frontonly else [-1,1]
 for side in sides:
  cols=math.ceil(w/.44);rows=math.ceil(depth/.58);tw=w/cols;tl=depth/rows
  for row in range(rows):
   for col in range(cols):
    x0=-w/2+col*tw;z0=row*tl;material='tilelight' if random.random()<.13 else 'tile'
    # Curved tile cross section and overlapping lip, genuine mesh geometry.
    for k in range(4):
     ua=k/4;ub=(k+1)/4
     ya=.052*math.cos(ua*math.tau);yb=.052*math.cos(ub*math.tau)
     verts=[(x0+ua*tw,ridge-z0*slope+ya+.035,z0*side),(x0+ub*tw,ridge-z0*slope+yb+.035,z0*side),(x0+ub*tw,ridge-(z0+tl+.07)*slope+yb+.055,(z0+tl+.07)*side),(x0+ua*tw,ridge-(z0+tl+.07)*slope+ya+.055,(z0+tl+.07)*side)]
     # Explicit upward order in game coordinates.
     normal=(Vector(verts[1])-Vector(verts[0])).cross(Vector(verts[2])-Vector(verts[0]))
     if normal.y<0:verts.reverse()
     mesh.face(verts,material)
    ze=z0+tl+.075;yy=ridge-ze*slope+.05
    mesh.rod((x0+.03,yy,ze*side),(x0+tw-.03,yy,ze*side),.025,'tilelight',6)
  mesh.rod((-w/2,ridge-depth*slope,side*(depth+.09)),(w/2,ridge-depth*slope,side*(depth+.09)),.095,'tiledeep',8)
  for sideX in [-1,1]:mesh.rod((sideX*w/2,ridge,0),(sideX*w/2,ridge-depth*slope,side*depth),.11,'tilelight',8)
 mesh.rod((-w/2-.13,ridge+.12,0),(w/2+.13,ridge+.12,0),.16,'tilelight',10)

def machiya(kind):
 root=group('machiya_'+kind);m=Mesh('Structure_'+kind);wall='ochre' if kind=='merchant' else 'plaster';upper=7.0 if kind=='inn' else 6.5
 m.box(0,.2,0,10,.4,9,'stonedark');m.box(0,3.35,0,9.8,6.3,8.8,wall)
 # Foundation and closely spaced vertical weatherboards on the side elevations.
 for side in [-1,1]:
  for z in np.arange(-4.3,4.5,.45):m.box(side*4.97,1.7,float(z),.13,2.8,.42,'cedar')
 for x in np.arange(-4.75,4.9,.45):m.box(float(x),1.5,4.49,.42,2.4,.12,'cedar')
 for x in [-4.85,-2.45,0,2.45,4.85]:m.box(x,3.55,4.58,.22,6.65,.22,'darkwood')
 for y in [.48,2.85,3.6,upper-.2]:m.box(0,y,4.61,10,.22,.25,'darkwood')
 # Deep shop windows, individual mullions, inner horizontal shelving.
 for x in [-3.1,3.1]:
  m.box(x,1.72,4.61,2.9,2.05,.12,'tiledeep');m.box(x,1.8,4.7,2.65,1.75,.07,'glass')
  for dx in np.arange(-1.27,1.3,.32):m.box(x+float(dx),1.8,4.8,.055,1.9,.12,'lightwood')
  for y in [1,1.85,2.7]:m.box(x,y,4.8,2.8,.07,.12,'lightwood')
 m.box(0,1.65,4.68,2.05,2.7,.15,'darkwood');m.box(0,1.8,4.79,1.65,2.2,.1,'glass')
 for x in np.arange(-.78,.85,.18):m.box(float(x),1.7,4.88,.045,2.5,.1,'cedar')
 m.box(0,.36,4.9,2.5,.2,.65,'stonewarm')
 for x in [-3.3,0,3.3]:
  m.box(x,5.08,4.57,2.75,1.6,.12,'darkwood');m.box(x,5.08,4.67,2.5,1.35,.09,'glass')
  for dx in np.arange(-1.2,1.22,.4):m.box(x+float(dx),5.08,4.76,.06,1.5,.11,'darkwood')
  for y in [4.6,5.1,5.6]:m.box(x,y,4.76,2.55,.055,.11,'darkwood')
 # Traditional projecting upper railing and brackets.
 m.box(0,4.25,4.88,10,.15,.5,'darkwood');m.box(0,4.78,4.99,10,.1,.13,'darkwood')
 for x in np.arange(-4.8,4.9,.35):m.box(float(x),4.52,4.98,.055,.52,.065,'darkwood')
 for x in [-4.6,-2.3,0,2.3,4.6]:m.rod((x,2.85,4.5),(x,3.15,5.45),.065,'darkwood',6)
 # Main roof, gable triangular fill, and curved lower eaves.
 r=Mesh('Kawara_'+kind);roof(r,11.15,5.05,upper+1.55,.33)
 for side in [-1,1]:m.face([(side*4.9,6.45,-4.4),(side*4.9,6.45,4.4),(side*4.9,upper+1.48,0)],wall)
 aw=Mesh('Shop_eaves_'+kind);roof(aw,10.9,1.35,3.95,.39,True)
 # Translate the one-sided awning forward before finalizing.
 aw.v=[(v[0],v[1],v[2]+4.32) for v in aw.v]
 m.box(0,3.87,4.42,10.6,.16,.28,'darkwood')
 cloth='green' if kind=='tea' else 'indigo' if kind=='inn' else 'rust'
 for i in range(5):m.box(-1.04+i*.52,2.71,5.04,.50,.71,.025,cloth)
 m.rod((-1.42,3.13,5.05),(1.42,3.13,5.05),.038,'lightwood',6)
 # Shop signboard is kept blank for the real Japanese labels drawn by Three.js.
 m.box(0,3.55,5.63,4.15,.53,.15,'lightwood')
 for x in [-4.35,4.35]:
  m.rod((x,2.0,5.0),(x,2.8,5.0),.23,'paper',12)
  for y in np.arange(2.04,2.82,.09):m.rod((x-.23,float(y),5),(x+.23,float(y),5),.011,'cedar',4)
  m.rod((x,2.78,5),(x,3.16,5),.018,'iron',6)
 # Gutters and downpipes.
 for side in [-1,1]:m.rod((side*5.2,.3,4.85),(side*5.2,3.45,4.85),.065,'iron',8)
 m.rod((-5.35,3.42,5.68),(5.35,3.42,5.68),.07,'iron',8)
 m.finish(root);r.finish(root);aw.finish(root)
 return root

def lamp():
 root=group('street_lamp');m=Mesh('Cast_iron_lantern')
 for y,h,r in [(.12,.24,.3),(.35,.22,.23),(.62,.32,.15),(2.05,2.6,.065),(3.42,.15,.14)]:m.rod((0,y-h/2,0),(0,y+h/2,0),r,'iron',10)
 m.rod((0,3.5,0),(0,4.15,0),.25,'paper',4,r2=.31)
 for x in [-.25,.25]:
  for z in [-.25,.25]:m.rod((x*.72,3.5,z*.72),(x,4.15,z),.026,'iron',6)
 m.rod((0,4.15,0),(0,4.4,0),.45,'iron',4,r2=.02);m.rod((0,4.4,0),(0,4.55,0),.045,'brass',6)
 m.rod((0,3.46,0),(0,3.55,0),.27,'iron',4);m.finish(root);return root

def planter():
 root=group('planter');m=Mesh('Cedar_planter');m.box(0,.27,0,.8,.5,.6,'cedar');m.box(0,.55,0,.84,.07,.64,'darkwood')
 for i in range(16):
  x=random.uniform(-.3,.3);z=random.uniform(-.2,.2);m.rod((x,.5,z),(x,.9+random.random()*.45,z),.055,'leaf' if i%2 else 'leaflight',5,r2=.01)
 m.finish(root);return root

def shrine():
 root=group('shrine');m=Mesh('Shrine_carpentry');m.box(0,.4,0,13,.8,10,'stonedark');m.box(0,3.0,0,11,4.7,8,'plaster')
 for x in [-5.5,-2.7,2.7,5.5]:m.rod((x,.8,4.1),(x,5.4,4.1),.22,'red',10)
 m.box(0,2.6,4.2,4.2,3.5,.22,'darkwood')
 for x in np.arange(-2,2.1,.23):m.box(float(x),2.6,4.4,.07,3.5,.13,'lightwood')
 for y in [1,4.7,5.3]:m.box(0,y,4.45,12,.3,.35,'red')
 for i in range(3):m.box(0,.12+i*.17,5+i*.5,7,.2,1.2,'stone')
 r=Mesh('Shrine_roof');roof(r,15,6.0,8.3,.48);m.finish(root);r.finish(root);return root

def torii():
 root=group('torii');m=Mesh('Vermilion_gate')
 for x in [-4.3,4.3]:m.rod((x,0,0),(x,5.9,0),.31,'red',12,r2=.23);m.rod((x,0,0),(x,.6,0),.35,'tiledeep',12)
 m.box(0,4.6,0,10.5,.3,.5,'red');m.box(0,5.75,0,11.9,.5,.6,'red');m.box(0,6.1,0,12.8,.25,.85,'tiledeep');m.box(0,5.25,.04,.65,.72,.25,'lightwood');m.finish(root);return root

prototypes=[machiya('tea'),machiya('merchant'),machiya('inn'),shrine(),lamp(),planter(),torii()]
# Export a small reusable GLB library. Objects are instanced by Three.js and by the .blend scene.
bpy.ops.object.select_all(action='DESELECT')
for root in prototypes:
 root.select_set(True)
 for child in root.children_recursive:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'koharu-architecture.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False)

# Assemble the editable full town with shared meshes.
proto={g.name:g for g in prototypes}
def place(name,x,z,yaw=0):
 source=proto[name];root=group(name+'_placed');root.location=(x,-z,0);root.rotation_euler.z=yaw
 for child in source.children:
  copy=child.copy();copy.data=child.data;bpy.context.collection.objects.link(copy);copy.parent=root
 return root
for b in layout['buildings']:place('shrine' if b['kind']=='shrine' else 'machiya_'+b['kind'],b['x'],b['z'],b['yaw'])
for x,z in layout['lamps']:place('street_lamp',x,z)
for x,z in [(-5.5,31),(5.5,12),(-5.5,8),(5.5,-10),(-5.5,-12)]:place('planter',x,z)
place('torii',45,-33)
for root in prototypes:
 for child in list(root.children):bpy.data.objects.remove(child,do_unlink=True)
 bpy.data.objects.remove(root,do_unlink=True)

# Real stone slabs and curbs form the main street; texture detail stays local to each stone.
ground=Mesh('Town_terrain');ground.box(0,-.2,0,158,.3,128,'earth')
paving=Mesh('Stone_paving')
def pave(x0,x1,z0,z1,stepx=1.2,stepz=.85):
 for row,z in enumerate(np.arange(z0,z1,stepz)):
  for x in np.arange(x0,x1,stepx):
   w=min(stepx,x1-x)-.035;d=min(stepz,z1-z)-.035
   if w<.1 or d<.1:continue
   paving.box(float(x+w/2),-.015,float(z+d/2),float(w),.12,float(d),random.choice(['stone','stone','stonewarm','stonedark']))
pave(-6.2,6.2,-60,48)
pave(-62,-6.2,-32,-24);pave(6.2,21,-32,-24);pave(-62,-6.2,16,24);pave(6.2,21,16,24);pave(35,62,-32,-24);pave(35,62,16,24)
pave(-39,-31,-50,-32);pave(-39,-31,-24,16);pave(-39,-31,24,34)
for x in [-6.45,6.45]:
 for z in np.arange(-59,48,1.8):paving.box(x,.045,float(z),.34,.17,1.77,'stonedark')
for x in [-5.85,5.85]:ground.box(x,.041,-6,.12,.035,117,'tiledeep')
ground.box(28,-.19,0,12,.08,130,'water')
for x in [21.4,34.6]:ground.box(x,.15,0,.8,.5,130,'stonedark')
for z in layout['bridges']:
 ground.box(28,.02,z,16,.3,8,'cedar')
 for x in np.arange(20.2,36,.5):ground.box(float(x),.18,z,.025,.01,8,'darkwood')
 for side in [-1,1]:
  ground.box(28,1.28,z+side*3.9,16,.16,.2,'red')
  for x in range(20,37,2):ground.box(x,.75,z+side*3.9,.18,1.5,.2,'red')
ridge=Mesh('Forest_ridge')
for x in range(-160,161,8):
 for z in range(-150,-70,8):
  def height(xx,zz):return 2+19*math.exp(-((zz+113)/30)**2)*(1+.25*math.sin(xx*.055)+.16*math.sin(xx*.14))
  ridge.face([(x,height(x,z),z),(x,height(x,z+8),z+8),(x+8,height(x+8,z+8),z+8),(x+8,height(x+8,z),z)],'hill')
ridge.finish()
ground.finish();paving.finish()
# Trees are assembled as tapered trunks and many modest polygon leaf clusters.
foliage=Mesh('Garden_trees')
for x,z in layout['trees']:
 foliage.rod((x,0,z),(x,4,z),.28,'cedar',8,r2=.12)
 for i in range(16):
  a=random.random()*math.tau;r=random.uniform(.3,2.2);xx=x+math.cos(a)*r;zz=z+math.sin(a)*r;yy=random.uniform(3.3,5.5)
  foliage.rod((x,2.8,z),(xx,yy,zz),.06,'cedar',5,r2=.025)
  foliage.rod((xx,yy-.5,zz),(xx,yy+.65,zz),random.uniform(.7,1.15),'leaf' if i%3 else 'leaflight',7,r2=.25)
foliage.finish()
# Export environment independently for fast loading and clear asset provenance.
bpy.ops.object.select_all(action='DESELECT')
for name in ['Town_terrain','Stone_paving','Garden_trees','Forest_ridge']:bpy.data.objects[name].select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'koharu-environment.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)

# An authored camera and sun make the editable Blender scene immediately reviewable.
world=bpy.data.worlds.new('Clear Kyoto afternoon');bpy.context.scene.world=world;world.use_nodes=True
nodes=world.node_tree.nodes;bg=nodes.get('Background');sky=nodes.new('ShaderNodeTexSky');sky.sky_type='NISHITA';sky.sun_elevation=math.radians(48);sky.sun_rotation=math.radians(125);sky.air_density=1.1;world.node_tree.links.new(sky.outputs['Color'],bg.inputs['Color']);bg.inputs['Strength'].default_value=.2
sun_data=bpy.data.lights.new('Afternoon sun','SUN');sun=bpy.data.objects.new('Afternoon sun',sun_data);bpy.context.collection.objects.link(sun);sun.rotation_euler=(.5,-.45,-.4);sun_data.energy=2.0;sun_data.angle=.12
cam_data=bpy.data.cameras.new('Street-level reference view');cam=bpy.data.objects.new('Street-level reference view',cam_data);bpy.context.collection.objects.link(cam);cam.location=(1.8,-35,2.7);target=Vector((-1,3,3.6));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.lens=25;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SOURCE/'koharu-street-render.png')
for area in bpy.context.screen.areas if bpy.context.screen else []:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'koharu-town.blend'),compress=True)
report={'blender':bpy.app.version_string,'buildings':len(layout['buildings']),'objects':len(scene.objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH'),'assets':[{'file':p.name,'bytes':p.stat().st_size} for p in OUT.glob('koharu-*.glb')]}
(SOURCE/'asset-report.json').write_text(json.dumps(report,indent=2));print('KOHARU_ASSETS',json.dumps(report),flush=True)
if '--render' in sys.argv:bpy.ops.render.render(write_still=True)
