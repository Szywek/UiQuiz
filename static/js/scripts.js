document.addEventListener("DOMContentLoaded", function () {


    // Sprawdzenie kontekstu strony przez ID unikalnych elementów
    if (document.querySelector("#start-game")) {
        // Sekcja dla index.html
        setupIndexPage();
    } else if (document.querySelector("#btn-next")) {
        // Sekcja dla quiz.html
        setupQuizPage();
    }
});

// Funkcja do obsługi logiki na index.html
function setupIndexPage() {
    console.log("Ładowanie strony index.html");

    let totalRounds = 0;
    const startGameButton = document.querySelector("#start-game");
    const enableVintageFilter = document.querySelector("#enable-vintage-filter");
    const vintageFilterOptions = document.querySelector("#vintage-filter-options");
    const startYearSelect = document.querySelector("#start-year");
    const endYearSelect = document.querySelector("#end-year");

    // Funkcja do dynamicznego generowania lat
    const populateYearSelect = (selectElement) => {
        for (let year = 1990; year <= 2028; year++) {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            selectElement.appendChild(option);
        }
    };

    function showLoadingScreen() {
       document.getElementById('loading-screen').style.display = 'flex';
   }

   function hideLoadingScreen() {
       document.getElementById('loading-screen').style.display = 'none';
   }

    // Inicjalizacja selectów rocznych
    populateYearSelect(startYearSelect);
    populateYearSelect(endYearSelect);

    // Pokaż/Ukryj opcje filtrowania czasu na podstawie checkboxa
    enableVintageFilter.addEventListener("change", (event) => {
        if (event.target.checked) {
            vintageFilterOptions.style.display = "block";
        } else {
            vintageFilterOptions.style.display = "none";
        }
    });

    if (startGameButton) {
        // Przypisz pojedynczy listener do przycisku
        startGameButton.addEventListener("click", () => {
            const loadingScreen = document.getElementById("loading-screen");
            loadingScreen.style.display = "flex"; // Pokazanie ekranu ładowania

            const selectedOption = document.querySelector('input[name="startOption"]:checked').value;

            // Pobierz wybrane typy utworów
            const selectedTypes = [];
            if (document.querySelector("#type-opening").checked) {
                selectedTypes.push("Opening");
            }
            if (document.querySelector("#type-ending").checked) {
                selectedTypes.push("Ending");
            }

            // Obsługa opcji filtrowania lat i sezonów
            let vintageFilter = null;
            if (enableVintageFilter.checked) {
                vintageFilter = {
                    startSeason: document.querySelector("#start-season").value,
                    startYear: document.querySelector("#start-year").value,
                    endSeason: document.querySelector("#end-season").value,
                    endYear: document.querySelector("#end-year").value
                };
            }

            fetch("/start", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    startOption: selectedOption,
                    types: selectedTypes,
                    vintageFilter: vintageFilter // przekazujemy filtr
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.song_count) {
                        totalRounds = data.song_count;
                        localStorage.setItem("totalRounds", totalRounds);
                        console.log("Załadowano piosenki:", totalRounds);
                    }

                    if (data.message === "Loaded") {
                        // Przekierowanie po udanym załadowaniu
                             setTimeout(function () {
                                   window.location.href = "/play";
                             }, 3000); // 3 sekundy do przejścia
                    }
                })
                .catch(error => {
                    console.error("Błąd podczas ładowania danych:", error);
                    loadingScreen.style.display = "none"; // Ukryj ekran ładowania w razie błędu
                    alert("Wystąpił problem z komunikacją z serwerem. Spróbuj ponownie.");
                });
        });
    }
}

// Funkcja do obsługi logiki na quiz.html
function setupQuizPage() {
    console.log("Ładowanie strony quiz.html");

    let isFirstClick = true; // Zmienna kontrolująca pierwsze kliknięcie "Dalej"

    // Najpierw deklaracje elementów
    const historyPanel = document.querySelector("#history-panel");
    const toggleHistoryButton = document.querySelector("#btn-toggle-history");

    // Zmienna globalna do przechowywania start_time i fragmentLength
    let currentStartTime = 0; // Punkt początkowy odtwarzania fragmentu
    let handleAudioTimeUpdate; // Referencja do funkcji obsługującej timeupdate
    let currentFragmentLength = 15; // Domyślna długość fragmentu
    let currentRound = 0; // Zaczynamy od 1. rundy
    // Zmienna do przechowywania historii odtworzonych utworów
    let songHistory = [];
    // Inicjalizuj JSFrame
    const jsFrame = new JSFrame();
    // Obiekt przechowujący stan okna historii
    let historyFrame = null;
    let currentSongDetails = null; // Szczegóły bieżącego utworu (niewidoczne, zapisane tymczasowo)
    // Pobierz totalRounds z localStorage
    let totalRounds = parseInt(localStorage.getItem("totalRounds"), 10) || 0;

    // Inicjalizacja elementów na quiz.html
    const currentRoundElement = document.querySelector("#currentRound");
    const totalRoundsElement = document.querySelector("#totalRounds");
    const nextButton = document.querySelector("#btn-next");
    const replayButton = document.querySelector("#btn-replay");
    const showButton = document.querySelector("#btn-show");
    const audioPlayer = document.querySelector("#audioPlayer");
    if (nextButton) {
        nextButton.style.display = "block"; // Ustaw widoczność "Dalej"
    } else {
        console.warn("Nie znaleziono przycisku #btn-next");
    }

    console.log("setupQuizPage loaded");

        // Funkcja obsługująca kliknięcie "Dalej"
    nextButton?.addEventListener("click", () => {
        if (isFirstClick) {
            isFirstClick = false; // Wyłącz na kolejne kliknięcia
            nextButton.style.display = "none"; // Ukryj przycisk po jednym kliknięciu
        }

        // Wywołaj logikę przejścia dalej
        executeNextActions();
    });

    // Obsługa Historii
   if (toggleHistoryButton) {
       toggleHistoryButton.addEventListener("click", () => {
           const isHidden = historyPanel.style.display === "none" || historyPanel.style.display === "";
           historyPanel.style.display = isHidden ? "block" : "none";
           toggleHistoryButton.textContent = isHidden ? "Ukryj historię" : "Pokaż historię";
       });
   }

    // Ustaw wyświetlanie totalRounds na stronie
    if (totalRoundsElement) {
        totalRoundsElement.textContent = totalRounds;
    }
    if (!currentRoundElement || !totalRoundsElement) {
        console.error("Elementy #currentRound lub #totalRounds nie zostały znalezione w HTML.");
        return;
    }


    // Obsługa przycisku "Dalej"
function executeNextActions() {



        knowResult.style.display = "show";


    fetch("/next", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ fragmentLength: fragmentLength }), // Wyślij długość fragmentu
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.audio_url) {
                currentStartTime = data.start_time;

                audioPlayer.pause();
                audioPlayer.src = data.audio_url;
                audioPlayer.addEventListener("loadedmetadata", () => {
                    audioPlayer.currentTime = currentStartTime;

            // Rozpocznij odtwarzanie po załadowaniu metadanych
            const playPromise = audioPlayer.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log("Odtwarzanie rozpoczęte:", currentStartTime);

                        // zatrzymywanie audio po określonym fragmencie
handleAudioTimeUpdate = function () {

if (audioPlayer.currentTime >= currentStartTime + parseInt(document.querySelector("#fragmentLength").value, 10) - 0.1) {
                                audioPlayer.pause();
                                console.log("Fragment został w pełni odtworzony.");
                                // Usuń nasłuchiwanie po zakończeniu fragmentu
                                audioPlayer.removeEventListener("timeupdate", handleAudioTimeUpdate);
                            }
                        };
                        audioPlayer.addEventListener("timeupdate", handleAudioTimeUpdate);
                    })
                    .catch((error) => {
                        console.error("Błąd odtwarzania:", error);
                    });
            }
        });

                if (currentRound < totalRounds) {
                    currentRound++;
                    currentRoundElement.textContent = currentRound;
                }

                document.querySelector("#details").style.display = "none";

                // Ustaw szczegóły dla bieżącego utworu
                document.querySelector("#animeJPName").innerHTML = `<b>Anime: </b>${data.song_details.animeJPName}`;
                document.querySelector("#songType").innerHTML = `<b>Typ utworu: </b>${data.song_details.songType}`;
                document.querySelector("#songArtist").innerHTML = `<b>Wykonawca: </b>${data.song_details.songArtist}`;
                document.querySelector("#songName").innerHTML = `<b>Tytuł utworu: </b>${data.song_details.songName}`;
                document.querySelector("#animeVintage").innerHTML = `<b>Sezon: </b>${data.song_details.animeVintage}`;

                currentSongDetails = {
                    round: currentRound,
                    animeJPName: data.song_details.animeJPName,
                    songName: data.song_details.songName,
                    songArtist: data.song_details.songArtist,
                    songType: data.song_details.songType,
                };
            }
        })
        .catch((error) => {
            console.error("Błąd podczas pobierania następnego utworu:", error);
        });
}

    // Obsługa przycisku "Powtórz"
if (replayButton) {
    replayButton.addEventListener("click", () => {
        if (audioPlayer) {

            console.log(`Powtórz utwór z obecnie ustawioną długością: ${fragmentLength} sekund.`);

            // Usuń poprzednie nasłuchiwanie zdarzenia timeupdate
            audioPlayer.removeEventListener("timeupdate", handleAudioTimeUpdate);

            // Zresetuj czas odtwarzania dźwięku
            audioPlayer.currentTime = currentStartTime;

            // Rozpoczęcie odtwarzania
            audioPlayer.play();

            // Dodaj precyzyjne sterowanie fragmentem przez timeupdate
audioPlayer.addEventListener("timeupdate", handleAudioTimeUpdate);
        }
    });
}
    // Obsługa przycisku "Pokaż"
    if (showButton) {
        showButton.addEventListener("click", () => {
            const detailsDiv = document.querySelector("#details");
            if (detailsDiv) {
                detailsDiv.style.display =
                    detailsDiv.style.display === "none" ? "block" : "none";
            }

            // Jeśli szczegóły są wyświetlane, odblokuj przyciski "know"
            if (detailsDiv && detailsDiv.style.display === "block") {
                enableKnowButtons();
            }

            // Dodaj do historii tylko, jeśli jeszcze utwór nie jest tam zapisany
            if (detailsDiv.style.display === "block" && currentSongDetails) {
                addSongToHistory(
                    currentSongDetails.round,
                    currentSongDetails.animeJPName,
                    currentSongDetails.songName,
                    currentSongDetails.songArtist,
                    currentSongDetails.songType
                );
                currentSongDetails = null; // Wyczyść szczegóły bieżącego utworu
            }
        });
    }

// Funkcja otwierająca/zamykająca okno historii
function toggleHistoryWindow() {
    if (historyFrame) {
        historyFrame.closeFrame(); // Zamknij istniejące okno
        historyFrame = null;
    } else {
        // Utworzenie nowego okna historii
        historyFrame = jsFrame.create({
            title: 'Historia Odtwarzania',
            left: 100, // Pozycja okna w poziomie
            top: 100, // Pozycja okna w pionie
            width: 400, // Szerokość
            height: 300, // Wysokość
            resizable: true, // Zezwala na skalowanie przez użytkownika
            movable: true, // Pozwala na przesuwanie
            html: `
                <div id="history-content" style="padding: 10px; overflow-y: auto; height: calc(100% - 20px);">
                    <p>Brak danych do wyświetlenia</p> 
                </div>
            `,
        });

        // Zaktualizuj treść okna po jego otwarciu
        updateHistoryContent();
    }
}

    // Funkcja aktualizująca zawartość okna
    function updateHistoryPanel() {
        const historyContent = document.querySelector("#history-content");
        if (songHistory.length === 0) {
            historyContent.innerHTML = "<p>Brak danych do wyświetlenia</p>";
        } else {
            historyContent.innerHTML = songHistory
                .map(
                    (song) => `
                        <div class="history-item">
                            <p><strong>Runda ${song.round}: ${song.animeJPName}</strong></p>
                            <p>Tytuł utworu: ${song.songName}</p>
                            <p>Wykonawca: ${song.songArtist}</p>
                            <p>Typ: ${song.songType}</p>
                        </div>
                    `
                )
                .join("");
        }
    }

    // Obsługa przycisku historii
    document.querySelector("#btn-toggle-history").addEventListener("click", toggleHistoryWindow);

    // Dodawanie danych do historii (podczas gry)
    function addSongToHistory(round, animeJPName, songName, songArtist, songType) {
        const historyContent = document.querySelector("#history-content");

        // Dodanie nowego elementu historii
        const newHistoryItem = document.createElement("div");
        newHistoryItem.classList.add("history-item"); // Dodanie klasy history-item
        newHistoryItem.innerHTML = `
            <p><strong>Runda ${round}: ${animeJPName}</strong></p>
            <p>Tytuł utworu: ${songName}</p>
            <p>Wykonawca: ${songArtist}</p>
            <p>Typ: ${songType}</p>
        `;

        historyContent.appendChild(newHistoryItem); // Dodanie do panelu historii
    }

    // Obsługa suwaka głośności
    const volumeControl = document.querySelector("#volumeControl");
    const volumeValue = document.querySelector("#volumeValue");

    if (volumeControl && audioPlayer) {
        audioPlayer.volume = volumeControl.value;

        volumeControl.addEventListener("input", () => {
            const volume = parseFloat(volumeControl.value);
            audioPlayer.volume = volume;
            volumeValue.textContent = Math.round(volume * 100);
        });
    }

    // Obsługa suwaka długości fragmentu
    const fragmentLengthSlider = document.querySelector("#fragmentLength");

    const fragmentLengthValue = document.querySelector("#fragmentLengthValue");

    if (fragmentLengthSlider && fragmentLengthValue) {
        fragmentLengthSlider.addEventListener("input", () => {
            const fragmentValue = fragmentLengthSlider.value;
            fragmentLengthValue.textContent = fragmentValue;
        });
    }

    //przyciski wiem, nie wiem

    let dontKnowOdds = [82, 63, 41, 22, 10, 5]; // Szanse dla "Nie wiem"
    let knowPlusOdds = [73, 52, 31, 15, 9, 4]; // Szanse dla "Wiem za 2"
    let knowIndex = 0; // Pozycja bieżącej szansy w tablicy
    let drinkCount = 0;
    let noDrinkCount = 0;


    // Obsługa panelu "Czy wiem?"
    const knowPanel = document.querySelector("#know-panel");
    const dontKnowButton = document.querySelector("#btn-dont-know");
    const knowPlusButton = document.querySelector("#btn-know-plus");
    const knowButton = document.querySelector("#btn-know");
    const knowResult = document.querySelector("#know-result");


    // Funkcje do blokowania i odblokowywania przycisków w sekcji "Czy wiem?"
    function disableKnowButtons() {
        dontKnowButton.disabled = true;
        knowPlusButton.disabled = true;
        knowButton.disabled = true;
    }

    function enableKnowButtons() {
        dontKnowButton.disabled = false;
        knowPlusButton.disabled = false;
        knowButton.disabled = false;
    }
        disableKnowButtons();

    // Obsługa przycisku "Nie wiem"
    dontKnowButton.addEventListener("click", () => {
        const chance = dontKnowOdds[knowIndex] || 5;
        console.log(`"Nie wiem" - Aktualna szansa: ${chance}%`);
        dontKnowClicks++;


        const result = Math.random() * 100;
        knowResult.style.display = "block";
        if (result < chance) {
            knowResult.textContent = "Pijemy!";
            knowResult.style.color = "red";
            drinkCount++
        } else {
            knowResult.textContent = "Nie pijemy!";
            knowResult.style.color = "limegreen";
            noDrinkCount++
        }

        // Aktualizacja koloru ostatniego elementu w historii
        updateLastHistoryItemColor("dont-know");
        updateDrinkCounters();
        updateClickCounters();
        executeNextActions();
        knowIndex = Math.min(knowIndex + 1, dontKnowOdds.length - 1);


    });

    // Obsługa przycisku "Wiem za 2"
    knowPlusButton.addEventListener("click", () => {
        const chance = knowPlusOdds[knowIndex] || 1;
        console.log(`"Wiem za 2" - Aktualna szansa: ${chance}%`);
        knowPlusClicks++;


        const result = Math.random() * 100;
        knowResult.style.display = "block";
        if (result < chance) {
            knowResult.textContent = "Pijemy!";
            knowResult.style.color = "red";
            drinkCount++
        } else {
            knowResult.textContent = "Nie pijemy!";
            knowResult.style.color = "limegreen";
            noDrinkCount++
        }

        // Aktualizacja koloru ostatniego elementu w historii
        updateLastHistoryItemColor("know-plus");
        updateDrinkCounters();
        updateClickCounters();
        executeNextActions();
        knowIndex = Math.min(knowIndex + 1, knowPlusOdds.length - 1);

    });

    // Obsługa przycisku "Wiem"
    knowButton.addEventListener("click", () => {
        console.log(`"Wiem" - Zawsze 100% szans.`);
        knowClicks++;


        knowResult.style.display = "block";
        knowResult.textContent = "Nie pijemy!";
        knowResult.style.color = "limegreen";
        noDrinkCount++
        updateDrinkCounters();
        updateClickCounters();
        executeNextActions();

        // Aktualizacja koloru ostatniego elementu w historii
        updateLastHistoryItemColor("know");

        knowIndex = 0;

    });

    let dontKnowClicks = 0;
    let knowPlusClicks = 0;
    let knowClicks = 0;

    function updateClickCounters() {
        const dontKnowCounter = document.querySelector("#dontKnowCounter");
        const knowPlusCounter = document.querySelector("#knowPlusCounter");
        const knowCounter = document.querySelector("#knowCounter");

        if (dontKnowCounter) {
            dontKnowCounter.textContent = dontKnowClicks;
        }
        if (knowPlusCounter) {
            knowPlusCounter.textContent = knowPlusClicks;
        }
        if (knowCounter) {
            knowCounter.textContent = knowClicks;
        }
    }

    // Funkcja do aktualizacji koloru ostatniego elementu w historii
    function updateLastHistoryItemColor(status) {
        const historyContent = document.querySelector("#history-content");

        if (!historyContent || !historyContent.children || historyContent.children.length === 0) {
            console.warn("Brak elementów w historii, nie można zaktualizować koloru.");
            return; // Jeśli nie ma elementów, przerywamy wykonanie
        }

        const lastHistoryItem = historyContent.lastElementChild;

        // Usuń wcześniejsze klasy (jeśli istnieją)
        lastHistoryItem.classList.remove("know", "know-plus", "dont-know");

        // Dodaj nową klasę na podstawie statusu
        if (status === "know") {
            lastHistoryItem.classList.add("know");
        } else if (status === "know-plus") {
            lastHistoryItem.classList.add("know-plus");
        } else if (status === "dont-know") {
            lastHistoryItem.classList.add("dont-know");
        }

        console.log("Zaktualizowano kolor ostatniego elementu w historii:", status);
    }

    function updateDrinkCounters() {
    const drinkCounter = document.querySelector("#drinkCounter");
    const noDrinkCounter = document.querySelector("#noDrinkCounter");

    if (drinkCounter) {
        drinkCounter.textContent = drinkCount;
    }
    if (noDrinkCounter) {
        noDrinkCounter.textContent = noDrinkCount;
    }
}

        // Obsługa przycisku "Nie wiem"
    dontKnowButton.addEventListener("click", () => {
        console.log(`Kliknięto "Nie wiem".`);
        disableKnowButtons(); // Zablokowanie przycisków po kliknięciu
    });

    // Obsługa przycisku "Wiem za 2"
    knowPlusButton.addEventListener("click", () => {
        console.log(`Kliknięto "Wiem za 2".`);
        disableKnowButtons(); // Zablokowanie przycisków po kliknięciu
    });

    // Obsługa przycisku "Wiem"
    knowButton.addEventListener("click", () => {
        console.log(`Kliknięto "Wiem".`);
        disableKnowButtons(); // Zablokowanie przycisków po kliknięciu
    });

    // Obsługa przycisku Powrót
    const backButton = document.querySelector("#btn-back");
    if (backButton) {
        backButton.addEventListener("click", () => {
            window.location.href = "/"; // Przekierowanie na stronę startową
        });
    }


}