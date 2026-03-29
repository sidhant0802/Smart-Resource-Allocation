import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export default function LocationPickerMap({
  onLocationSelect,
  showRadius = true,
  defaultRadius = 10,
}) {
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const marker       = useRef(null)

  const [selected, setSelected]       = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [radius, setRadius]           = useState(defaultRadius)
  const [isSearching, setIsSearching] = useState(false)

  // Init map
  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     'mapbox://styles/mapbox/streets-v12',
      center:    [78.9629, 20.5937],
      zoom:      3.5,
    })

    map.current.addControl(
      new mapboxgl.NavigationControl(), 'top-right'
    )

    map.current.on('click', (e) => {
      placeMarkerAt(e.lngLat.lng, e.lngLat.lat)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  const placeMarkerAt = async (lng, lat) => {
    if (marker.current) marker.current.remove()

    marker.current = new mapboxgl.Marker({ color: '#2563EB' })
      .setLngLat([lng, lat])
      .addTo(map.current)

    map.current.flyTo({ center: [lng, lat], zoom: 12, duration: 1000 })

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
        `${lng},${lat}.json` +
        `?access_token=${mapboxgl.accessToken}&language=en`
      )
      const data = await res.json()
      const name = data.features?.[0]?.place_name ||
                   `${lat.toFixed(4)}, ${lng.toFixed(4)}`

      const location = { lat, lng, name }
      setSelected(location)
      setSearchQuery(name)
      setSuggestions([])
      onLocationSelect({ ...location, radius })

    } catch (err) {
      const location = {
        lat,
        lng,
        name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      }
      setSelected(location)
      onLocationSelect({ ...location, radius })
    }
  }

  const handleSearchChange = async (value) => {
    setSearchQuery(value)
    if (value.length < 3) {
      setSuggestions([])
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
        `${encodeURIComponent(value)}.json` +
        `?access_token=${mapboxgl.accessToken}` +
        `&country=in&limit=5&language=en`
      )
      const data = await res.json()
      setSuggestions(data.features || [])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }

  const selectSuggestion = (feature) => {
    const [lng, lat] = feature.center
    placeMarkerAt(lng, lat)
    setSuggestions([])
  }

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius)
    if (selected) {
      onLocationSelect({ ...selected, radius: newRadius })
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeMarkerAt(pos.coords.longitude, pos.coords.latitude)
      },
      () => alert('Could not get your location')
    )
  }

  return (
    <div className="space-y-3">

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="🔍 Search location..."
            className="w-full px-4 py-2.5 border border-gray-200
                       rounded-xl text-sm focus:outline-none
                       focus:ring-2 focus:ring-blue-500"
          />

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50
                            bg-white border border-gray-200 rounded-xl
                            shadow-xl mt-1 overflow-hidden max-h-48
                            overflow-y-auto">
              {suggestions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectSuggestion(f)}
                  className="w-full text-left px-4 py-2.5 text-sm
                             hover:bg-blue-50 border-b border-gray-100
                             last:border-0"
                >
                  <p className="font-medium text-gray-800 truncate">
                    {f.text}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {f.place_name}
                  </p>
                </button>
              ))}
            </div>
          )}

          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2
                              border-blue-500 border-t-transparent
                              rounded-full"/>
            </div>
          )}
        </div>

        {/* My Location Button */}
        <button
          type="button"
          onClick={useMyLocation}
          title="Use my current location"
          className="px-3 py-2.5 bg-blue-50 border border-blue-200
                     rounded-xl text-blue-600 hover:bg-blue-100
                     transition-colors text-lg"
        >
          📍
        </button>
      </div>

      {/* Map */}
      <div
        ref={mapContainer}
        className="w-full h-56 rounded-xl overflow-hidden
                   border border-gray-200"
      />
      <p className="text-xs text-gray-400 text-center">
        Click on map or search above to select location
      </p>

      {/* Radius Slider */}
      {showRadius && (
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="flex justify-between mb-1">
            <label className="text-xs font-medium text-gray-700">
              Operating Radius
            </label>
            <span className="text-xs font-bold text-blue-600">
              {radius} km
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={radius}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </div>
      )}

      {/* Selected Location */}
      {selected && (
        <div className="flex items-start gap-2 bg-green-50
                        border border-green-200 rounded-xl p-3">
          <span className="text-green-500 mt-0.5">✅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">
              Location Selected
            </p>
            <p className="text-xs text-green-600 truncate">
              {selected.name}
            </p>
            <p className="text-xs text-green-400">
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}