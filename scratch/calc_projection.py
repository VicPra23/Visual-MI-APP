import numpy as np

# Camera: perspective 1250, origin at (480, 115.2, 0)
# Rig: center at (480, 180, 0)
# Rotation: rotateX(-22deg) rotateY(180deg)

pitch = -22.0 * np.pi / 180.0
yaw = 180.0 * np.pi / 180.0

Rx = np.array([
    [1, 0, 0],
    [0, np.cos(pitch), -np.sin(pitch)],
    [0, np.sin(pitch), np.cos(pitch)]
])

Ry = np.array([
    [np.cos(yaw), 0, np.sin(yaw)],
    [0, 1, 0],
    [-np.sin(yaw), 0, np.cos(yaw)]
])

# Rig transform applied to a point p relative to rig center (480, 180, 0):
# In CSS, transform: rotateX(-22deg) rotateY(180deg) -> applied right-to-left: Ry then Rx!
R_rig = Rx @ Ry

print("Testing vertices...")

# table-face-top in rig:
# Y = 162 (so relative to center Y is 162 - 180 = -18)
# X relative to center: -480 to +480
# Z relative to center: -180 to +180
# Front edge of tabletop (facing Cara A): Z = +180
# Back edge of tabletop (facing Cara B): Z = -180

# When yaw = 180deg:
# Ry @ (x, -18, +180) = (-x, -18, -180)
# Ry @ (x, -18, -180) = (-x, -18, +180)

# Now table-face-bottom:
# Y = 204 (so relative to center Y is 204 - 180 = +24)
# What is its normal?
# rotateX(-90deg):
# corners: Z goes from +180 to -180!

p_top_caraA = np.array([0, -18, 180])
p_top_caraB = np.array([0, -18, -180])

p_bot_caraA = np.array([0, 24, 180])
p_bot_caraB = np.array([0, 24, -180])

for name, pt in [("top_caraA", p_top_caraA), ("top_caraB", p_top_caraB), ("bot_caraA", p_bot_caraA), ("bot_caraB", p_bot_caraB)]:
    world = R_rig @ pt
    # Camera perspective:
    # d = 1250
    # perspective factor = d / (d - world[2])
    pf = 1250.0 / (1250.0 - world[2])
    y_screen = 180 + world[1] * pf
    print(f"{name} -> world: Y={world[1]:.1f}, Z={world[2]:.1f} | Y_screen={y_screen:.1f}, Z_depth={world[2]:.1f}")
