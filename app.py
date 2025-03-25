from flask import Flask, render_template, request, jsonify, redirect, url_for
import csv
import random
from time import sleep
import uniform
import waitress
from waitress import serve
from threading import Timer
import webbrowser

app = Flask(__name__)

# Zewnętrzna URL do plików audio
BASE_AUDIO_URL = "https://naedist.animemusicquiz.com/"

# Lista annSongId shuffle'owana przy starcie gry
shuffled_song_ids = []

start_option = "Start"  # Domyślna wartość na wypadek, gdyby użytkownik nic nie wybrał

def open_browser():
    webbrowser.open("http://127.0.0.1:5000")  # Uruchomienie przeglądarki z określonym adresem

# Funkcja pomocnicza do ładowania danych z pliku CSV
def load_csv(file_path):
    songs = []
    with open(file_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            row['songLength'] = float(row['songLength']) if row['songLength'] else 0
            songs.append(row)
    return songs


# Funkcja do pobierania najlepszego linku do audio
def get_audio_link(row):
    if row['audio']:
        return BASE_AUDIO_URL + row['audio']
    elif row['HQ']:
        return BASE_AUDIO_URL + row['HQ']
    elif row['MQ']:
        return BASE_AUDIO_URL + row['MQ']
    else:
        return None


# Widok główny z ustawieniami quizu
@app.route('/')
def index():
    return render_template('index.html')


# API do startowania gry i zwracania załadowanych danych
@app.route('/start', methods=['POST'])
def start_game():
    global shuffled_song_ids, start_option, fragment_length

    # Odbieramy dane z żądania
    data = request.get_json()
    start_option = data.get("startOption", "Start")
    fragment_length = data.get("fragmentLength", 15)
    selected_types = data.get("types", [])
    vintage_filter = data.get("vintageFilter", None)

    # Załaduj dane z CSV
    songs = load_csv('baza.csv')

    # Filtrowanie po typie utworu
    if selected_types:
        songs = [
            song for song in songs
            if "songType" in song and any(
                song_type.lower() in song["songType"].lower()
                for song_type in selected_types
            )
        ]

    # Filtrowanie po animeVintage
    if vintage_filter:
        start_vintage = f'{vintage_filter["startSeason"]} {vintage_filter["startYear"]}'
        end_vintage = f'{vintage_filter["endSeason"]} {vintage_filter["endYear"]}'

        def is_in_vintage_range(vintage):
            if not vintage:
                return False
            return start_vintage <= vintage <= end_vintage

        songs = [
            song for song in songs
            if "animeVintage" in song and is_in_vintage_range(song["animeVintage"])
        ]

    if not songs:
        return jsonify({"message": "No songs available for the selected options."}), 400

    # Wymieszaj ID piosenek po filtrowaniu
    shuffled_song_ids = random.sample([song["annSongId"] for song in songs], len(songs))

    return jsonify({"message": "Loaded", "song_count": len(shuffled_song_ids)})






# API do obsługi następnego utworu
from random import uniform  # Losowanie liczb zmiennoprzecinkowych


@app.route('/next', methods=['POST'])
def next_song():
    global shuffled_song_ids, start_option

    if not shuffled_song_ids:
        return jsonify({"message": "No more songs"}), 400

    request_data = request.get_json()  # Pobranie danych z frontendu
    fragment_length = request_data.get("fragmentLength", 15)  # Pobranie długości fragmentu (domyślnie 15s)

    song_id = shuffled_song_ids.pop(0)
    all_songs = load_csv('baza.csv')

    for song in all_songs:
        if song_id == song["annSongId"]:
            audio_url = get_audio_link(song)

            # Sprawdzamy długość utworu
            song_length = song.get('songLength', 0)
            if not song_length:
                song_length = 95

            # Obliczanie startowego punktu
            start_time = 0
            if start_option == "Start":
                start_time = 0.01 * song_length
            elif start_option == "Middle":
                start_time = 0.5 * song_length
            elif start_option == "Random":
                start_time = uniform(0.1, 0.75) * song_length

            return jsonify({
                "song_id": song["annSongId"],
                "audio_url": audio_url,
                "start_time": start_time,
                "fragment_length": fragment_length,
                "song_details": {
                    "animeType": song["animeType"],
                    "animeJPName": song["animeJPName"],
                    "songType": song["songType"],
                    "songArtist": song["songArtist"],
                    "songName": song["songName"],
                    "animeVintage": song["animeVintage"],
                    "songLength": song_length
                }
            })
    return jsonify({"message": "Song not found"}), 404

# Widok do rozpoczęcia gry
@app.route('/play')
def play():
    return render_template('quiz.html')


if __name__ == '__main__':
    Timer(1, open_browser).start()
    serve(app, host='127.0.0.1', port=5000)