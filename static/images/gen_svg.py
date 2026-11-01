with open('static/images/india_mainland_path.txt') as f:
    path_d = f.read().strip()

svg = f'''<svg viewBox="0 0 100 116" class="standee-map-svg" width="84" height="98" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-label="Official Map of India Silhouette">
  <path d="{path_d}" />
  <circle cx="34.2" cy="38.5" r="1.6" fill="currentColor"/>
</svg>'''

with open('static/images/standee_india.svg', 'w') as f:
    f.write(svg)

print('Generated standee_india.svg successfully!')
