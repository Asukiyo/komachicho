"""Export the rigged citizen and an original machiya shop interior for the Web game."""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/koharu-citizen.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'koharu-citizen.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_yup=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system='METRIC'
def material(name,color,rough=.8):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
    return m
wood=material('Interior_cedar',(.22,.12,.058));dark=material('Interior_timber',(.07,.043,.025));paper=material('Interior_washi',(.76,.72,.57));tatami=material('Interior_tatami',(.35,.39,.2));indigo=material('Interior_indigo',(.022,.072,.12));ceramic=material('Interior_ceramic',(.25,.42,.32),.24);screen=material('Interior_screen',(.08,.25,.26),.3)
screen.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(.12,.34,.32,1)
screen.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.8
def box(name,x,y,z,w,h,d,mat,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Soft_edges','BEVEL');b.width=bevel;b.segments=2
    return o
def cylinder(name,x,y,z,r,h,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=h,location=(x,-z,y));o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    b=o.modifiers.new('Soft_edges','BEVEL');b.width=.012;b.segments=2
    return o
# Floorboards, plaster walls, timber framing, and shoji windows form one reusable room.
for i in range(32):box('Floorboard',-3.88+i*.25,-.035,0,.24,.07,9,wood,.008)
for x in [-4,4]:
    box('Plaster_wall',x,1.65,0,.12,3.3,9,paper)
    for z in [-4.5,-2.25,0,2.25,4.5]:box('Wall_post',x-.08*(1 if x>0 else -1),1.7,z,.15,3.4,.15,dark)
for z in [-4.5,4.5]:box('End_wall',0,1.65,z,8,3.3,.12,paper)
for x in [-3.9,0,3.9]:box('Ceiling_beam',x,3.3,0,.18,.23,9,dark)
box('Ceiling',0,3.45,0,8,.1,9,wood)
for side in [-1,1]:
    x=side*3.88
    box('Shoji_paper',x,1.75,-.2,.04,1.7,3,paper)
    for z in [-1.7,-1.2,-.7,-.2,.3,.8,1.3]:box('Shoji_lattice',x-side*.035,1.75,z,.06,1.8,.035,wood,.006)
    for y in [1,1.4,1.8,2.2,2.6]:box('Shoji_lattice',x-side*.04,y,-.2,.06,.035,3,wood,.006)
box('Exit_door',0,1.25,4.4,1.65,2.5,.12,dark)
for i in range(5):box('Exit_noren',-.64+i*.32,2.35,4.29,.3,.65,.025,indigo,.002)
box('Counter',1.25,.56,-2.9,3.9,1.12,.85,wood)
box('Counter_top',1.25,1.15,-2.9,4.05,.11,1,dark)
box('Desk',-2.5,.74,-2.1,1.75,.12,.95,wood)
for x in [-3.2,-1.8]:
    for z in [-2.48,-1.72]:box('Desk_leg',x,.36,z,.08,.72,.08,dark)
box('Computer',-2.5,1.14,-2.3,1.04,.68,.055,dark)
box('Computer_display',-2.5,1.14,-2.265,.92,.56,.012,screen)
box('Computer_stand',-2.5,.87,-2.3,.11,.2,.09,dark)
box('Keyboard',-2.5,.815,-1.94,.69,.025,.22,dark,.01)
box('Chair_seat',-2.5,.46,-1.15,.5,.1,.5,wood)
for x in [-2.7,-2.3]:
    for z in [-1.35,-.95]:box('Chair_leg',x,.22,z,.045,.44,.045,dark,.01)
box('Chair_back',-2.5,.82,-.95,.5,.72,.05,wood)
for row in range(2):
    for col in range(2):box('Tatami',1+col*1.06,.025,.5+row*1.86,1.02,.05,1.82,tatami,.006)
box('Low_table',1.55,.39,1.35,1.15,.09,.8,wood)
for x in [1.1,2]:
    for z in [1.1,1.6]:box('Low_table_leg',x,.18,z,.07,.36,.07,dark)
for x in [-2.8,-1.8,-.8,.2,1.2,2.2,3.2]:
    for y in [.8,1.6,2.4]:box('Shelf',x,y,-4.12,.96,.065,.47,wood)
for x in [-3.32,-.3,3.72]:box('Shelf_post',x,1.4,-4.12,.08,2.8,.5,dark)
# These products are toggled when the corresponding commission has been delivered.
growth=bpy.data.objects.new('Delivered_products',None);bpy.context.collection.objects.link(growth)
for x in [-1.8,-.8,.2,1.2,2.2,3.2]:
    for y in [.93,1.73,2.53]:
        for dx in [-.23,0,.23]:cylinder('Ceramic_cup',x+dx,y,-4.04,.075,.19,ceramic).parent=growth
for x in [-.1,.4,.9,1.4,1.9,2.4]:cylinder('Counter_cup',x,1.3,-2.8,.09,.2,ceramic).parent=growth
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/koharu-interior.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'koharu-interior.glb'),export_format='GLB',export_yup=True,export_animations=False,export_apply=True)
print('BROWSER_LIFE_ASSETS_READY')
