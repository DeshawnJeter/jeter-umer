# UI checker

Check title consistency, selected art theme and player/background contrast independently. Verify hud.layout is cards or compact and hud.stats contains exactly the three supported metrics: health,time,stars for survival; stars,time,objective for the other game types. Reject duplicate, unsupported or invented metrics such as MP without a mana mechanic. Survival health is three shields and stars heal; maze stars are optional. These meanings are implemented by the trusted template: the identifier health is sufficient and no annotation or extra artifact field is permitted or required. The template owns pause, remapping, music and SFX settings. Do not claim model review or a contrast calculation verifies actual gameplay, audio or controls. Whole-game browser testing must verify displayed stats, timer/physics freezing, resuming, remapping and persisted settings.

## Independent review contract
Review a separate copy of the task and artifact. Use checker skills and inspection tools. Return pass, fail or needs_human with string findings and evidence. Ask a structured question when evidence depends on a missing human decision. Do not propose or write repairs.
