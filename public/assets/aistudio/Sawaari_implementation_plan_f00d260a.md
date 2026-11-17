# SAWAARI — APPROVED UI REDESIGN IMPLEMENTATION

You are working directly inside the existing Google AI Studio Sawaari application.

I have provided a visual design reference image showing the proposed redesign of all major application pages.

Your job is to implement this design in the EXISTING application, not create a separate prototype or a new application.

## A. DESIGN REFERENCE

Treat the uploaded Sawaari design image as the primary visual reference.

Follow its:

- Screen composition.
    
- OLED-black visual direction.
    
- Cyan accent colour.
    
- Typography hierarchy.
    
- Field positioning.
    
- Card proportions.
    
- Spacing and alignment.
    
- Button styles.
    
- Navigation appearance.
    
- Mobile-first layout.
    

Reproduce the design as closely as practical while retaining the application's actual functionality.

Do not blindly copy example data, labels, or features from the image.

## B. PRESERVE THE EXISTING APPLICATION

Before making changes, inspect the existing source code.

Identify the actual implemented components, forms, database models, and functionality.

Preserve:

- React and TypeScript architecture.
    
- Existing Dexie/IndexedDB database.
    
- Existing database name and stored records.
    
- Existing Nepali date utilities.
    
- Existing local-first functionality.
    
- Existing PWA/offline functionality.
    
- Existing theme selector and all available themes.
    
- Existing implemented fields and validation.
    

Do not introduce a mandatory backend, account system, or cloud storage.

## C. STRICT FEATURE RULES

The existing four main destinations must remain:

1. Dashboard
    
2. Maintenance
    
3. Tax
    
4. Documents
    

Keep Settings accessible through its existing entry point.

Do not add new destinations such as Insights or Records merely because they appear in the reference image.

Do not introduce unimplemented features such as:

- Fuel Check.
    
- Trip Cost Calculator.
    
- New analytics.
    
- New expense workflows.
    
- AI vehicle-health scores.
    
- New insurance management workflows if they are not implemented.
    

Existing expense records or insurance document types may remain available where already supported. Do not turn them into new standalone features.

## D. REMOVE MOCK DATA

Remove automatic production demo-data generation.

Do not show sample Yamaha motorcycles, fictional registration numbers, fake maintenance history, fake tax records, or artificial dashboard statistics.

Never delete existing real user records as part of this task.

For a new installation, show genuine empty states and guide the user to add a vehicle.

Fix the existing initialization/reset logic so that clearing data does not recreate demo records.

## E. FIELD AND FORM RULES

This is a redesign of the actual forms, not permission to invent a new data model.

For every existing form:

1. Inspect the current TypeScript interface.
    
2. Identify all current fields.
    
3. Preserve their underlying data mapping.
    
4. Improve the visible label.
    
5. Improve field width and alignment.
    
6. Choose an appropriate control type.
    
7. Group related fields.
    
8. Distinguish required and optional fields.
    
9. Preserve validation and editing functionality.
    

Do not silently remove fields.

If a field is moved into an expandable More Details section, it must remain accessible and saved.

Do not change database field names simply to change their visible labels.

## F. IMPLEMENTATION METHOD

Work one phase at a time.

Before each phase:

- Identify relevant source files.
    
- Explain what will change.
    
- Identify the existing functionality that must remain.
    

After each phase:

- Check TypeScript errors.
    
- Check application build.
    
- Test the relevant interactions.
    
- Verify existing data is still accessible.
    
- Summarise changed files.
    

Do not start the next phase until the current phase is completed and verified.

Keep a working backup or Git checkpoint before major changes.

## G. FINAL REQUIREMENT

Implement the approved design in the existing application.

Do not replace working forms with static mockups.

Every visible button must work.

Every form must save to the existing local database.

All existing themes must continue to work.

Do not use demo data.

The splash screen and first-time-user setup must be implemented in the final phase, after the main application pages are complete.

I will provide a separate instruction for each implementation phase.