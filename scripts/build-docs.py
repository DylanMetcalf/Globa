"""Builds docs/GLOBA-Walkthrough.html from the screenshots in docs/img (then Playwright renders the PDF)."""
import os, html
D = os.path.join(os.path.dirname(__file__), '..', 'docs')
def have(n): return os.path.exists(os.path.join(D, 'img', n + '.png'))
def fig(n, cap, cls=''):
    if not have(n): return ''
    return f'<figure class="{cls}"><img src="img/{n}.png" alt="{html.escape(cap)}"><figcaption>{cap}</figcaption></figure>'
def figs(items, cls='row'):
    inner = ''.join(fig(n, c, 'm') for n, c in items if have(n))
    return f'<div class="{cls}">{inner}</div>' if inner else ''
def ul(items): return '<ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'
def say(t): return f'<div class="say"><b>Say:</b> {t}</div>'
def tip(t): return f'<div class="tip">{t}</div>'
def sec(title, body, num=None): return f'<section><h2>{title}</h2>{body}</section>'

WORLDS = [('savanna','Africa · savanna'),('asia','Asia · garden'),('europe','Europe · countryside'),('northamerica','North America · wilds'),('southamerica','South America · highlands'),('oceania','Oceania · shores'),('antarctica','Antarctica · ice'),('desert','Desert'),('rainforest','Rainforest'),('lake','Lakeside'),('alpine','Alpine snow'),('coast','Seaside'),('volcano','Volcanic island')]
worlds = '<div class="grid3">' + ''.join(f'<figure class="m"><img src="img/world-{k}.png"><figcaption>{c}</figcaption></figure>' for k, c in WORLDS if have('world-' + k)) + '</div>'

body = []
body.append(f'''
<header class="cover">
  <div class="mark">GLOBA</div>
  <h1>Walkthrough &amp; Demo Guide</h1>
  <p class="tag">Your world. Your adventures. Your story.</p>
  <p class="for">Made for Dylan &amp; Nicole</p>
  {fig('01-intro','The opening screen: a rotating globe, the GLOBA mark and a single “Enter your world” button.','hero')}
</header>''')

body.append(sec('How to use this guide', f'''
<p>This document does two jobs. <b>Part A</b> is a ten-minute demo script you can follow word for word when showing GLOBA to someone. <b>Part B</b> is a reference to every page, element and feature, with screenshots, so you can look up “what is that thing?” later.</p>
{ul(['Screenshots show sample data: seven saved places, two lit up, one visited, one 3-month itinerary. Your own app will start empty.',
 'Photos come live from Wikipedia, so they may differ slightly from what you see here. Places without a photo show clearly-labelled generated artwork.',
 'Every piece of information is labelled <b>Live</b> (fetched just now from a named source), <b>Curated</b> (our editorial sample data, not verified), <b>Estimate</b>, <b>Demo</b> or <b>Your entry</b>. Nothing sample is ever passed off as live.'])}
<h3>Before you demo</h3>
{ul(['Open the app (see the deployment steps in the pull request) and tap <b>Enter your world</b>, or skip with Esc.',
 'Save 3–5 places first (Cape Town, Lisbon and Queenstown work well) so the Saved, Our World and map screens are not empty.',
 'On a phone, add it to the home screen for the full-screen app feel.',
 'Sound is off by default. Turn it on in Settings → Sound if you want the light-switch and ambience.'])}
'''))

# PART A
body.append('<div class="part">Part A · The ten-minute demo</div>')
body.append(sec('The story to tell', f'''
<p>GLOBA is a shared adventure platform: <b>discover</b> places you might live for weeks or months, <b>save</b> them, <b>plan</b> them, and <b>light them up</b> on your shared globe. Keep that arc in mind: <i>find → save → plan → light up</i>.</p>
<table class="demo">
<tr><th>#</th><th>Minute</th><th>Do this</th><th>Say this</th></tr>
<tr><td>1</td><td>0:00</td><td>Show the intro, tap <b>Enter your world</b>.</td><td>“This is GLOBA. Two runners, hand in hand, exploring the world. It's for the two of us.”</td></tr>
<tr><td>2</td><td>0:45</td><td>Drag the globe, scroll to zoom, hover countries.</td><td>“A real 3D globe. Countries light up as you hover; the glossy numbers are clusters of places.”</td></tr>
<tr><td>3</td><td>1:30</td><td>Search <b>Queenstown</b> and pick it. The side panel opens.</td><td>“Each place has a quick card: photo, why it's special, and what's nearby.”</td></tr>
<tr><td>4</td><td>2:15</td><td>Press <b>Map</b>, then <b>Globe</b> again.</td><td>“Same places, same selection: one tap changes perspective from globe to flat map.”</td></tr>
<tr><td>5</td><td>3:00</td><td>Open <b>Discover</b>, tap “Find a quiet mountain town where we could live for three months”.</td><td>“We describe what we want in plain English. It turns that into filters, ranks real places and explains each match. It says clearly when it's in demo mode.”</td></tr>
<tr><td>6</td><td>4:15</td><td>Open a result's <b>brief</b>; scroll Main reason → Long-stay → Best time.</td><td>“A little editorial travel guide. Notice every row says whether it's curated, an estimate, or live.”</td></tr>
<tr><td>7</td><td>5:15</td><td>Tap <b>Suggest More</b> → Coffee shops → <b>Suggest</b>.</td><td>“Real nearby places pulled live from OpenStreetMap. We never invent a business to fill a list.”</td></tr>
<tr><td>8</td><td>6:00</td><td>Tap <b>Save</b>, then <b>Add to itinerary</b> → New itinerary.</td><td>“Saved, planned, visited are different things, with their own colours and shapes.”</td></tr>
<tr><td>9</td><td>6:45</td><td>Trips → open an itinerary; move a stop with the arrows; open Stays.</td><td>“Day-by-day plans and long stays across countries. Times are suggestions, and it labels what's an estimate.”</td></tr>
<tr><td>10</td><td>7:45</td><td>On a saved place tap <b>Light it up</b>. Walk to the glowing bulb, press <b>E</b> (or the button).</td><td>“Our little world. Different for each place. Dylan dances, Nicole claps and jumps.”</td></tr>
<tr><td>11</td><td>9:00</td><td>The camera pulls back, the globe flies to the place and it glows. Finish on <b>Our World</b>.</td><td>“Every place we light up becomes part of our story, and the counts are real: no made-up progress.”</td></tr>
</table>
{tip('<b>If something is slow or empty:</b> the live data (photos, nearby places, weather) comes from free public services. If one is down, GLOBA shows a clear message and everything else keeps working. Say so; it makes a good point about honesty.')}
'''))

# PART B
body.append('<div class="part">Part B · Page-by-page reference</div>')

body.append(sec('1 · Getting around', f'''
<p>On a computer there is a slim <b>left rail</b>; on a phone a <b>bottom tab bar</b>. The five main places are the same on both.</p>
<table class="ref"><tr><th>Item</th><th>What it does</th></tr>
<tr><td><b>Explore</b></td><td>The globe and 2D map: find, preview and select places.</td></tr>
<tr><td><b>Discover</b></td><td>Describe what you want, or use filters, to get ranked matches.</td></tr>
<tr><td><b>Saved</b></td><td>Your shared collection: considering, planned, visited, notes, tags.</td></tr>
<tr><td><b>Trips</b></td><td>Itineraries: create, edit, duplicate, delete.</td></tr>
<tr><td><b>Our World</b></td><td>Your stats, glowing globe and achievements.</td></tr>
<tr><td><b>Ask</b> (sparkles)</td><td>The travel assistant, aware of the place you're looking at.</td></tr>
<tr><td><b>Settings</b></td><td>Profiles, characters, theme, sound, units, data backup, integrations.</td></tr>
<tr><td><b>Coloured “D” / “N” circle</b></td><td>Switch between Dylan's and Nicole's profile (tap it). Both share one collection.</td></tr></table>
'''))

body.append(sec('2 · Explore: the globe', f'''
{fig('02-explore-globe','Explore: the 3D globe. Glossy numbered orbs are clusters of places; zoom in and they split apart.')}
{ul(['<b>Drag</b> to rotate, <b>scroll / pinch</b> to zoom, <b>hover or tap a country</b> to highlight it and open its panel.',
'<b>Search bar (top):</b> type a place, a country, or a sentence. It suggests places, countries and live worldwide towns as you type.',
'<b>Filter button</b> beside the search opens the filters drawer.',
'<b>Globe / Map</b> toggle (top right) switches view.',
'<b>+ / − / home</b> (right) zoom and reset the view.',
'<b>Layers</b> (bottom left) shows or hides marker types.',
'<b>The little spaceship</b> with Dylan and Nicole drifts across; tap it for a quip.'])}
<h3>Marker legend: shape <i>and</i> colour, never colour alone</h3>
<table class="ref"><tr><th>Marker</th><th>Meaning</th></tr>
<tr><td>★ gold star, glowing</td><td><b>Activated</b>: you lit it up in the miniature world.</td></tr>
<tr><td>■ green square with a tick</td><td><b>Visited</b>: you've actually been.</td></tr>
<tr><td>◆ turquoise diamond</td><td><b>Planned</b>: part of an itinerary or marked planned.</td></tr>
<tr><td>● lilac sphere</td><td><b>Saved</b>: you're considering it.</td></tr>
<tr><td>● small blue sphere</td><td><b>Discover</b>: a place in the catalogue you haven't saved.</td></tr>
<tr><td>Big numbered orb</td><td>A cluster: tap to zoom in. Personal markers are never hidden inside clusters.</td></tr></table>
{fig('03-layers','Layers: switch marker types on or off. The legend uses shape as well as colour.','half')}
'''))

body.append(sec('3 · Explore: search, preview, map', f'''
{fig('04-search-suggest','Search suggestions: curated places, countries, and “Live lookup” towns from anywhere in the world.')}
{fig('05-place-panel','Selecting a place opens its panel: photo (with credit), reason to visit, Save / Add to itinerary / Light it up, and extraordinary places nearby.')}
{ul(['<b>Save</b> adds to the shared collection; tap again to remove (with Undo).',
'<b>Add to itinerary</b> lets you pick a trip and day, or create a new trip.',
'<b>Light it up</b> takes you into the miniature world for that place.',
'<b>Open full brief</b> goes to the full guide (section 5).',
'<b>Extraordinary nearby</b> lists striking landmarks within reach; tap one to fly there.'])}
{fig('06-map-view','The 2D map: same places, same selection and filters. If map tiles cannot load, country outlines still draw so it never goes blank.')}
{tip('Switching Globe ↔ Map keeps the selected place. The globe pans left when a panel is open so the place isn\'t hidden behind it.')}
{fig('07-explore-results','Type a sentence (“unusual natural landscapes near Cape Town”) and results appear in the panel with reasons.')}
{fig('09-filters','The filters drawer: stay length, budget, crowds, and collapsible groups (natural environment, lifestyle, practical needs…). Active choices appear as removable chips; you can save presets.')}
{fig('10-lit-globe','After lighting a place: the globe flies to it, a gold beam and pulsing rings mark it, and its country tints.')}
'''))

body.append(sec('4 · Discover', f'''
{fig('11-discover-home','Discover: example questions, landscape shortcuts, and “Picked for Dylan” based on preferences in Settings.')}
{fig('12-discover-results','Results: your sentence becomes filter chips (editable), then the top five matches with reasons, “Fit %”, and a note on what to check.')}
{ul(['<b>Mode badge</b> (top right): “Demo mode” = built-in keyword understanding; “AI mode” appears when an AI key is configured.',
'<b>Reasons list</b>: green ticks = what matched; amber = something to check.',
'<b>Budgets:</b> estimates are in US dollars. Other currencies are compared only if live exchange rates are available, and it says so when they aren\'t.',
'<b>Nothing fits?</b> It says so plainly rather than inventing a result, and offers a worldwide town lookup.'])}
'''))

body.append(sec('5 · The destination brief', f'''
<p>Every place opens as a full guide. Sections are labelled with where their information comes from.</p>
{fig('13-brief-top','Top of a brief: cover photo, name, status badges, Save / Add to itinerary / Light it up, categories, summary, and a live Wikipedia excerpt.')}
{fig('14-brief-why','Main reason to visit: one clear primary reason with the reasoning, plus secondary reasons and the best-fit traveller.')}
{fig('15-brief-nearby','Extraordinary nearby places: distances are straight-line and labelled so; real travel time varies.')}
{fig('16-brief-longstay','Long-stay suitability: internet, cost for two (converted with live rates when possible), transport, healthcare, climate… Safety and visas are deliberately marked “Not verified” with links to official sources.')}
{fig('17-brief-time','Best time: a 12-month strip with “Sweet spot” months (good weather but quieter), plus an optional live 7-day forecast.')}
{fig('18-brief-accommodation','Accommodation: honest by design. No fake listings or prices, just search links and real places listed on OpenStreetMap.')}
{fig('19-brief-summary','Practical summary: best reason, ideal stay, main practical issue and what to research before committing.')}
{fig('20-suggest-more','Suggest More: choose categories, set distance, then Suggest. Up to five real results with Details / Save / Add to itinerary and “Show alternatives”.')}
{fig('21-brief-sources','Sources &amp; confidence: what is curated, what is live, and what GLOBA doesn\'t check.')}
'''))

body.append(sec('6 · Saved places', f'''
{fig('22-saved','Saved: three status tiles at the top, then cards with status, priority, tags, notes and shortcuts.')}
{ul(['<b>Considering / Planned / Visited</b> are separate. “Lit up” is a separate filter, since lighting a place never means you visited it.',
'Search notes and tags; sort; group by country or destination.',
'<b>Add notes</b> and <b>tags</b> on any card; both of you edit the same collection.',
'<b>Remove</b> shows an Undo so nothing is lost by accident.',
'Cards list which itineraries a place is in.'])}
'''))

body.append(sec('7 · Trips (itineraries)', f'''
{fig('23-itineraries','The collection: cover, destinations, dates, purpose, number of stops and days, plan status.')}
<h3>The guided builder</h3>
<p>Eight short steps: purpose → where → when → how long → focus → budget → pace → which saved places to include. Optional steps can be skipped.</p>
{fig('wizard-last','The last wizard step: choose saved places to include, then Create itinerary.','half')}
{fig('24-itinerary-days','The editor: Days tab with times, durations and stops. A route map and the “assumptions” note (what is a suggestion and what is unchecked) sit alongside.')}
{fig('25-itinerary-stop-open','Open a stop to change type, day, cost, link and notes. Reorder with the arrow buttons or by dragging; both are keyboard accessible.')}
{fig('26-itinerary-stays','Stays tab for long trips across several places: tentative vs committed, arrival and departure, living-cost estimate, internet, transport and work notes.')}
{ul(['<b>Regenerate</b> a day for a fresh offline suggestion.',
'Overlapping times are flagged.',
'Changes save as you type (“Saved locally”). Duplicate and Delete (with Undo) are at the top.',
'Meals are generic (“Lunch — local café”). Real venues come from Suggest More.'])}
'''))

body.append(sec('8 · Light It Up: the miniature world', f'''
<p>Saving a place can end with a small celebration. From any place choose <b>Light it up</b>.</p>
<ol class="steps"><li><b>Arrive.</b> The camera swoops down onto a floating island. The glowing beam shows where to go.</li>
<li><b>Walk.</b> <span class="k">W A S D</span> or arrow keys, drag to look around (phone: joystick). Your partner follows beside you and waves if you pause.</li>
<li><b>Activate.</b> Get close, then press <span class="k">E</span> / tap the big gold button.</li>
<li><b>Celebrate.</b> The sky turns golden, flowers bloom, lanterns light. Dylan does his victory dance; Nicole claps then jumps.</li>
<li><b>Return.</b> A card confirms it, the camera pulls back, and the real location lights up on the globe.</li></ol>
{figs([('33-game-start','1 · Start of the walk'),('34-game-near-bulb','2 · Near the bulb'),('35-game-lighting','3 · Let there be light'),('36-game-celebrate','4 · Celebrating together'),('37-game-card','5 · Result card')])}
{ul(['<b>Skip</b> lights the place immediately; <b>✕ / Esc</b> leaves without lighting.','Lighting is recorded once and never changes Saved → Visited.','If 3D isn\'t available the app offers “Light it up anyway” (a simple 2D version) so nothing is blocked.','Sound (optional): light-switch, success chime, gentle ambience; off until enabled in Settings.'])}
<h3>Thirteen worlds, chosen for each place</h3>
<p>The world matches the place: seven continent styles plus desert, rainforest, lake, alpine, coast and volcano. Camels and pyramids in the desert, giraffes and elephants on the savanna, pagodas and pandas in Asia, penguins and an aurora in Antarctica, and more.</p>
{worlds}
{tip('Preview any world by adding <code>?theme=desert</code> (or savanna, asia, europe, northamerica, southamerica, oceania, antarctica, rainforest, lake, alpine, coast, volcano) to a <code>/light/&lt;place&gt;</code> address.')}
'''))

body.append(sec('9 · Our World', f'''
{fig('27-our-world','Our World: a globe of your places, stat tiles (discovered, saved, planned, lit up, visited, itineraries, countries explored) and the explorers.')}
{fig('28-our-world-achievements','Achievements show real progress bars. They\'re earned only by real actions: First Light, First Adventure, Five Places Saved, First Itinerary, First Country Explored, Nature Collector, Weekend Explorer, World in Progress.')}
{ul(['No streaks, no daily pressure, nothing invented.','“Countries explored” counts only places marked <b>Visited</b>.','Recent lights list who lit what and when.'])}
'''))

body.append(sec('10 · Settings', f'''
{fig('29-settings','Settings: profiles (switch between Dylan and Nicole), then characters, preferences, appearance and more.')}
{fig('30-settings-characters','Characters: outfit colour, skin, hair, accessory, reference notes. They\'re placeholders until personalised from photos, and the app says so.')}
{ul(['<b>Travel preferences</b> per person (interests, climate, stay length, budget, remote-work needs) feed “Picked for you” in Discover.',
'<b>Appearance:</b> light, dark or follow device; reduced motion.','<b>Sound:</b> off by default; volume slider.','<b>Units &amp; currency:</b> kilometres or miles; home currency.',
'<b>Your data:</b> Export a backup, import one, or erase everything. Data lives in this browser only, so back it up and use it to move between devices.'])}
{fig('31-settings-integrations','Integrations: an honest status board. Live (works now), Demo (running on built-in data) or Unavailable, with the setting that turns each on.')}
'''))

body.append(sec('11 · The travel assistant', f'''
{fig('32-assistant','The assistant knows the place you\'re viewing and your saved places. In demo mode it answers from the catalogue with simple rules and labels itself; with an AI key it gives open-ended, grounded answers.')}
{ul(['Try: “Find five places like this one”, “Which of our saved places is best for three months?”, “Compare Lisbon and Chiang Mai for remote work”, “Build a relaxed three-day itinerary”.','It refuses to name restaurants from memory and points you to <b>Suggest More</b> instead.','Every answer is badged: <i>Demo answer</i> or <i>AI-generated from retrieved data</i>.'])}
'''))

body.append(sec('12 · On your phone', f'''
<p>The phone version isn\'t a squeezed desktop: there is a bottom tab bar, bottom sheets instead of side panels, a thumb-sized joystick and big action buttons, and it works in landscape too.</p>
{figs([('m-01-explore','Explore'),('m-02-sheet','Place bottom sheet'),('m-03-discover','Discover'),('m-04-brief','Brief')])}
{figs([('m-05-saved','Saved'),('m-06-world','Our World'),('m-07-game','Miniature world with joystick')])}
{tip('Add to Home Screen: in Safari tap Share → Add to Home Screen; in Chrome use the menu → Install app. It then opens full screen with its own icon.')}
'''))

body.append(sec('13 · What is live, what is demo', '''
<table class="ref"><tr><th>Feature</th><th>Status today</th><th>To make it live</th></tr>
<tr><td>Globe, map, search, filters, saved places, itineraries, Our World, miniature world</td><td>Real, local to your browser</td><td>—</td></tr>
<tr><td>Country outlines</td><td>Real (bundled)</td><td>—</td></tr>
<tr><td>Destination catalogue (36 places, 86 landmarks)</td><td>Curated sample, not live-verified</td><td>Add or replace data in <code>src/data</code></td></tr>
<tr><td>Worldwide town lookup, weather, Wikipedia photos &amp; summaries, nearby places, exchange rates</td><td>Live, no key needed</td><td>—</td></tr>
<tr><td>AI understanding, explanations, assistant, itinerary drafts</td><td>Demo mode</td><td>Add <code>ANTHROPIC_API_KEY</code> (or <code>OPENAI_API_KEY</code>) on the server</td></tr>
<tr><td>Accommodation listings, routing / travel times</td><td>Not connected (search links and straight-line distances shown)</td><td>Implement a provider in <code>server/providers</code></td></tr>
<tr><td>Accounts and syncing between your phones</td><td>Not built</td><td>Future: login + database</td></tr></table>
'''))

body.append(sec('14 · Troubleshooting &amp; FAQ', '''
<table class="ref"><tr><th>Problem</th><th>What to do</th></tr>
<tr><td>My saved places aren\'t on my other phone</td><td>Data is per browser. Settings → Export backup on one, Import backup on the other.</td></tr>
<tr><td>Photos show “Illustration”</td><td>No photo was found (or the photo service was unreachable). It\'s generated artwork, and it\'s labelled.</td></tr>
<tr><td>Suggest More says it\'s unavailable</td><td>The free OpenStreetMap service is busy or blocked. Try again in a minute; search links are offered meanwhile.</td></tr>
<tr><td>Map is dark / no streets</td><td>Tiles couldn\'t load. Country outlines and your markers still work. Configure <code>MAP_TILE_URL</code> for a dedicated provider.</td></tr>
<tr><td>The globe or miniature world won\'t load</td><td>Your device may not support 3D graphics. A simplified globe and a 2D “Light it up anyway” are used, and everything else works.</td></tr>
<tr><td>Things feel slow on an older phone</td><td>Turn on Settings → Reduced motion; close other tabs.</td></tr>
<tr><td>“Demo mode” everywhere</td><td>No AI key is set on the server. Everything still works.</td></tr>
<tr><td>I erased everything by mistake</td><td>Import your latest backup, so export regularly.</td></tr></table>
<h3>Keyboard shortcuts</h3>
<table class="ref"><tr><td><span class="k">Tab</span></td><td>Move focus (first stop is “Skip to content”)</td><td><span class="k">Esc</span></td><td>Close panels / leave the miniature world / skip the intro</td></tr>
<tr><td><span class="k">W A S D</span> / arrows</td><td>Walk in the miniature world</td><td><span class="k">E</span> / Enter / Space</td><td>Activate the bulb</td></tr></table>
<h3>Glossary of badges</h3>
<p><span class="b live">Live</span> fetched just now from a named source · <span class="b cur">Curated</span> editorial sample data · <span class="b est">Estimate</span> rough figure, verify · <span class="b demo">Demo</span> offline demonstration · <span class="b ai">AI</span> written by an AI model from retrieved data · <span class="b usr">Your entry</span> typed by you.</p>
'''))

css = '''
@font-face{font-family:'Outfit';src:url('../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2');font-weight:100 900}
@font-face{font-family:'Manrope';src:url('../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2');font-weight:200 800}
@page{size:A4;margin:16mm 14mm}
*{box-sizing:border-box}
body{font-family:'Manrope',system-ui,sans-serif;color:#0f1530;font-size:10.5pt;line-height:1.55;margin:0}
h1,h2,h3,.mark,.part{font-family:'Outfit',sans-serif}
.cover{min-height:250mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always;background:radial-gradient(900px 500px at 80% -10%,rgba(124,108,255,.18),transparent 60%),radial-gradient(700px 400px at 0% 20%,rgba(34,193,176,.16),transparent 60%)}
.mark{letter-spacing:.35em;font-weight:600;color:#0b8f88;font-size:16pt}
.cover h1{font-size:34pt;margin:6px 0;letter-spacing:-.03em}
.tag{font-size:13pt;color:#3f4766;margin:0}.for{color:#66708f;margin:6px 0 18px}
.part{background:linear-gradient(100deg,#0b8f88,#5b5bd6);color:#fff;padding:10px 16px;border-radius:10px;font-size:15pt;font-weight:600;margin:20px 0 6px;break-before:page}
section{margin:0 0 6mm}
h2{font-size:18pt;margin:22px 0 8px;letter-spacing:-.02em;border-bottom:2px solid #e6ecf6;padding-bottom:5px;break-after:avoid}
h3{font-size:12.5pt;margin:14px 0 4px;break-after:avoid;color:#0b8f88}
figure{margin:10px 0;break-inside:avoid}
figure img{width:100%;border-radius:10px;border:1px solid #dfe5f2;box-shadow:0 2px 10px rgba(15,21,48,.08);display:block}
figure.hero img{max-width:150mm;margin:0 auto}
figure.half img{max-width:110mm}
figcaption{font-size:9pt;color:#53597a;margin-top:4px}
.row{display:flex;gap:8px;align-items:flex-start;margin:10px 0}.row figure{flex:1;min-width:0}
.row figure img{border-radius:8px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.grid3 figure{margin:0}
ul{padding-left:18px;margin:6px 0}li{margin:2px 0}
table{width:100%;border-collapse:collapse;margin:8px 0;font-size:9.5pt}
th,td{border:1px solid #dfe5f2;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#eef2fa;font-family:'Outfit';font-weight:600}
table.demo td:nth-child(1),table.demo td:nth-child(2){white-space:nowrap}
tr{break-inside:avoid}
.say{background:#eefaf8;border-left:3px solid #0b8f88;padding:6px 10px;margin:6px 0;border-radius:0 8px 8px 0}
.tip{background:#fff6e0;border-left:3px solid #f2b84b;padding:8px 12px;margin:10px 0;border-radius:0 8px 8px 0;font-size:10pt}
.k{display:inline-block;border:1px solid #b8c0d8;border-bottom-width:2px;border-radius:5px;padding:0 6px;font:700 8.5pt 'Manrope';background:#fff}
code{background:#eef2fa;padding:1px 5px;border-radius:5px;font-size:9pt}
ol.steps li{margin:4px 0}
.b{display:inline-block;padding:1px 9px;border-radius:99px;font-size:8.5pt;font-weight:700}
.b.live{background:#d9f4e6;color:#1d7a4d}.b.cur{background:#dcf3f1;color:#0b8f88}.b.est,.b.demo{background:#fdecc8;color:#8a5200}.b.ai{background:#e8e4ff;color:#5b4fc4}.b.usr{background:#e6ecf6}
footer{margin-top:10mm;color:#66708f;font-size:9pt;text-align:center}
'''
open(os.path.join(D, 'GLOBA-Walkthrough.html'), 'w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>GLOBA — Walkthrough &amp; Demo Guide</title><style>' + css + '</style></head><body>' + ''.join(body) + '<footer>GLOBA walkthrough · screenshots use sample data · regenerate with scripts/capture-docs.mjs and scripts/build-docs.py</footer></body></html>')
print('html written')
