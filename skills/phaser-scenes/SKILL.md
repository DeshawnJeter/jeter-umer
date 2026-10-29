# Phaser scene conventions

Use for gameplay and UI work. Keep initialization in scene creation and movement/time progression in update. Reset score and timer on restart. Bound the player to the world and collide with walls. Winning requires every collectible and the exit. Maintain a read-only observable game state for test tools. Treat browser evidence separately from configuration checks.

The demo specialist configures a trusted template. It does not edit or generate arbitrary game JavaScript.
