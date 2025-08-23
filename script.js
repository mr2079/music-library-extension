const DB_KEY = "audio_playlists";

let listAudio = [];
let currentAudio = document.getElementById("myAudio");
let indexAudio = 0;
let playListContainer = document.querySelector("#playlistCtn");

const previousElement = document.querySelector("#previous");
const rewindElement = document.querySelector("#rewind");
const toggleAudioElement = document.querySelector("#toggleAudio");
const forwardElement = document.querySelector("#forward");
const nextElement = document.querySelector("#next");
const toggleMuteElement = document.querySelector("#toggleMute");
const removeElement = document.querySelector("#remove");

toggleAudioElement.addEventListener("click", toggleAudio);
previousElement.addEventListener("click", previous);
nextElement.addEventListener("click", next);
// toggleMuteElement.addEventListener("click", toggleMute);

// rewindElement.addEventListener("click", rewind);
// forwardElement.addEventListener("click", forward);
// removeElement.addEventListener("click", remove);

async function getSavedAudios() {
  return new Promise((resolve) => {
    chrome.storage.local.get([DB_KEY], (result) => {
      resolve(result[DB_KEY] || []);
    });
  });
}

function replace(input, replace = "") {
  return input.replace(/\s+/g, replace);
}

async function getBlob(url) {
  return fetch(url).then(async (response) => {
    return await response.blob();
  });
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

async function getMusicTags(url) {
  const blob = await getBlob(url);

  const tags = await new Promise((resolve, reject) => {
    jsmediatags.read(blob, {
      onSuccess: (tag) => {
        const tags = {
          title: tag?.tags?.title?.trim() || null,
          artist: tag?.tags?.artist?.trim() || null,
          album: tag?.tags?.album?.trim() || null,
          year: tag?.tags?.year?.trim() || null,
        };

        let cover = null;
        if (tag.tags.picture) {
          const { data, format } = tag.tags.picture;
          const byteArr = new Uint8Array(data);
          const pictureBlob = new Blob([byteArr], { type: format });
          cover = URL.createObjectURL(pictureBlob);
        }

        resolve({ ...tags, cover });
      },
      onError: () => {
        reject(null);
      },
    });
  });

  const duration = await new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration);
    });
  });

  const formatted = formatDuration(duration);

  return { ...tags, duration: formatted };
}

let selectedItems = [];

let trackItemIndex = 1;

async function createTrackItem(index, name, file) {
  const trackItem = document.createElement("div");
  trackItem.id = `ptc-${index}`;
  trackItem.dataset.index = index;
  trackItem.className =
    "w-full h-[70px] px-6 rounded-sm hover:bg-[#2C2B30]/50 relative flex items-center py-5 cursor-pointer";
  const tags = await getMusicTags(file);
  // const tags = null;
  trackItem.innerHTML = `
    <div class="w-[45%] h-full flex items-center">
      <span class="mr-6 text-white text-lg font-book opacity-70 w-[45px]">${
        trackItemIndex++
      }</span>
      <img
        alt="Cover"
        src="${tags?.cover ?? "./images/commonimages/dummy-cover-thumb.png"}"
        width="300"
        height="300"
        class="h-full w-fit"
      />
      <div class="w-full h-full flex flex-col justify-center ml-4">
        <h1
          id="song_title_0"
          class="font-book text-white cursor-default">
          ${tags?.title ?? name}
        </h1>
        <h1 class="text-xs text-[#B2B3B2] mt-1">
          <span
            class="hover:text-white hover:underline cursor-pointer font-book">
            ${tags?.artist ?? "Unknown"}
          </span>
        </h1>
      </div>
    </div>
    <div class="w-[28%] h-full flex items-center">
      <h1 class="text-white text-sm font-book opacity-70">
        ${tags?.album ?? "Single track"}
      </h1>
    </div>
    <div class="w-[22%] h-full flex items-center">
      <h1 class="text-white text-sm font-book opacity-70">
        ${tags?.year ?? "Unknown"}
      </h1>
    </div>
    <div class="w-[10%] h-full flex items-center justify-end">
      <img
        alt="Heart Icon"
        src="./images/commonicons/hearticongreen.svg"
        width="15"
        height="15"
        class="mr-8 cursor-pointer"
        style="color: transparent"
      />
      <h1 class="text-white text-sm font-book opacity-70">${
        tags?.duration ?? "0:00"
      }</h1>
    </div>
  `;

  trackItem.addEventListener("click", () => {
    if (index === indexAudio) {
      toggleAudio();
    } else {
      loadNewTrack(index);
    }
  });

  playListContainer.appendChild(trackItem);
}

// function createTrackItem(index, name, duration, file) {
//   const trackItem = document.createElement("div");
//   trackItem.className = "playlist-track-ctn";
//   trackItem.id = `ptc-${index}`;
//   trackItem.dataset.index = index;

//   const playBtnItem = document.createElement("div");
//   playBtnItem.className = "playlist-btn-play";
//   playBtnItem.id = `pbp-${index}`;

//   const btnImg = document.createElement("i");
//   btnImg.className = "fas fa-play";
//   btnImg.id = `p-img-${index}`;

//   playBtnItem.appendChild(btnImg);

//   const trackInfoItem = document.createElement("div");
//   trackInfoItem.className = "playlist-info-track";
//   trackInfoItem.textContent = name;

//   const trackDurationItem = document.createElement("div");
//   trackDurationItem.className = "playlist-duration";
//   trackDurationItem.textContent = duration;

//   const selectBox = document.createElement("input");
//   selectBox.type = "checkbox";
//   selectBox.id = `sb-${replace(name, "_")}`;
//   selectBox.className = "playlist-selectbox";
//   // removeBtn.className = "remove-btn";
//   selectBox.addEventListener("click", (e) => {
//     e.stopPropagation();
//     // removeAudio(file);
//     if (e.target.checked) {
//       selectedItems.push(file);
//     } else {
//       selectedItems = selectedItems.filter((src) => src != file);
//     }
//   });

//   // const icon = document.createElement("i");
//   // icon.className = "fas fa-times";
//   // removeBtn.appendChild(icon);

//   // removeBtn.addEventListener("click", (e) => {
//   //   e.stopPropagation();
//   //   removeAudio(file);
//   // });

//   trackItem.appendChild(playBtnItem);
//   trackItem.appendChild(trackInfoItem);
//   trackItem.appendChild(trackDurationItem);
//   // trackItem.appendChild(removeBtn);
//   trackItem.appendChild(selectBox);

//   trackItem.addEventListener("click", () => {
//     if (index === indexAudio) {
//       toggleAudio();
//     } else {
//       loadNewTrack(index);
//     }
//   });

//   playListContainer.appendChild(trackItem);
// }

async function removeAudios(files) {
  const audios = await getSavedAudios();
  const updated = audios.filter((src) => !files.includes(src));
  chrome.storage.local.set({ [DB_KEY]: updated }, () => {
    location.reload();
  });
}

async function renderPlaylist() {
  const audios = await getSavedAudios();
  if (audios.length === 0) return;

  listAudio = audios.map((src) => ({
    name: decodeURIComponent(src.split("/").pop()),
    file: src,
    duration: "",
  }));

  listAudio.forEach(
    async (audio, index) => await createTrackItem(index, audio.name, audio.file)
  );

  document.querySelector("#source-audio").src = listAudio[indexAudio].file;
  const tags = await getMusicTags(listAudio[indexAudio].file);
  // const tags = null;
  document.querySelector("#title").textContent =
    tags?.title ?? listAudio[indexAudio].name;
  document.querySelector("#artist").textContent = tags?.artist ?? "Unknown";
  if (tags?.cover) {
    document.querySelector("#player-music-cover").src = tags.cover;
  }
  currentAudio.load();
}

renderPlaylist();

async function loadNewTrack(index) {
  currentAudio.pause();
  document.querySelector("#source-audio").src = listAudio[index].file;
  const tags = await getMusicTags(listAudio[index].file);
  // const tags = null;
  document.querySelector("#title").textContent =
    tags?.title ?? listAudio[index].name;
  document.querySelector("#artist").textContent = tags?.artist ?? "Unknown";
  if (tags?.cover) {
    document.querySelector("#player-music-cover").src = tags.cover;
  }
  currentAudio.load();
  toggleAudio();
  // updateStylePlaylist(indexAudio, index);
  indexAudio = index;
}

function toggleAudio() {
  if (currentAudio.paused) {
    document.querySelector("#icon-play").style.display = "none";
    document.querySelector("#icon-pause").style.display = "block";
    // document.querySelector(`#ptc-${indexAudio}`).classList.add("active-track");
    // playToPause(indexAudio);
    currentAudio.play();
  } else {
    document.querySelector("#icon-play").style.display = "block";
    document.querySelector("#icon-pause").style.display = "none";
    // pauseToPlay(indexAudio);
    currentAudio.pause();
  }
}

function pauseAudio() {
  currentAudio.pause();
  clearInterval(interval1);
}

currentAudio.ontimeupdate = onTimeUpdate;

function onTimeUpdate() {
  const t = currentAudio.currentTime;
  // document.querySelector(".timer").textContent = getMinutes(t);
  setBarProgress();
  if (currentAudio.ended) {
    document.querySelector("#icon-play").style.display = "block";
    document.querySelector("#icon-pause").style.display = "none";
    // pauseToPlay(indexAudio);
    if (indexAudio < listAudio.length - 1) {
      loadNewTrack(indexAudio + 1);
    }
  }
}

function setBarProgress() {
  const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
  document.getElementById("seek_bar").style.width = `${progress}%`;
}

function getMinutes(t) {
  const min = String(Math.floor(t / 60)).padStart(2, "0");
  const sec = String(Math.floor(t % 60)).padStart(2, "0");
  return `${min}:${sec}`;
}

document
  .querySelector("#seek_background")
  .addEventListener("click", (event) => {
    const percent = event.offsetX / event.currentTarget.offsetWidth;
    currentAudio.currentTime = percent * currentAudio.duration;
    document.getElementById("seek_bar").style.width = `${percent * 100}%`;
  });

function forward() {
  currentAudio.currentTime += 5;
  setBarProgress();
}

function rewind() {
  currentAudio.currentTime -= 5;
  setBarProgress();
}

function next() {
  if (indexAudio < listAudio.length - 1) {
    loadNewTrack(indexAudio + 1);
  }
}

function previous() {
  if (indexAudio > 0) {
    loadNewTrack(indexAudio - 1);
  }
}

function updateStylePlaylist(oldIndex, newIndex) {
  document.querySelector(`#ptc-${oldIndex}`).classList.remove("active-track");
  pauseToPlay(oldIndex);
  document.querySelector(`#ptc-${newIndex}`).classList.add("active-track");
  playToPause(newIndex);
}

function playToPause(index) {
  const ele = document.querySelector(`#p-img-${index}`);
  ele.classList.replace("fa-play", "fa-pause");
}

function pauseToPlay(index) {
  const ele = document.querySelector(`#p-img-${index}`);
  ele.classList.replace("fa-pause", "fa-play");
}

function toggleMute() {
  const volUp = document.querySelector("#icon-vol-up");
  const volMute = document.querySelector("#icon-vol-mute");
  currentAudio.muted = !currentAudio.muted;
  volUp.style.display = currentAudio.muted ? "none" : "block";
  volMute.style.display = currentAudio.muted ? "block" : "none";
}

async function remove() {
  if (selectedItems) {
    await removeAudios(selectedItems);
  }
}

// const searchContainer = document.querySelector(".search-container");
// const searchInput = document.getElementById("search-bar");

// function performSearch(query) {
//   const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
//     query
//   )}`;
//   window.open(searchUrl, "_blank");
// }

// searchInput.addEventListener("keydown", (event) => {
//   if (event.key === "Enter") {
//     const query = searchInput.value;
//     if (query.trim()) {
//       performSearch(query);
//     }
//   }
// });

// // document.addEventListener("keydown", (event) => {
// //   if (event.key === "/" && document.activeElement !== searchInput) {
// //     event.preventDefault();
// //     searchInput.focus();
// //   }
// // });

// const suggestionsBox = document.getElementById("suggestions-box");
// let debounceTimer;

// searchInput.addEventListener("input", () => {
//   clearTimeout(debounceTimer);
//   debounceTimer = setTimeout(() => {
//     const query = searchInput.value.trim();
//     if (query.length === 0) {
//       suggestionsBox.innerHTML = "";
//       suggestionsBox.style.display = "none";
//       return;
//     }

//     fetch(`http://localhost:3000/suggest/${encodeURIComponent(query)}`)
//       .then((res) => res.json())
//       .then((data) => {
//         if (data.success && Array.isArray(data.data) && data.data.length > 0) {
//           suggestionsBox.innerHTML = data.data
//             .map(
//               (suggestion) =>
//                 `<li style="padding: 5px; cursor: pointer;">${suggestion}</li>`
//             )
//             .join("");
//           suggestionsBox.style.display = "block";

//           suggestionsBox.querySelectorAll("li").forEach((li) => {
//             li.addEventListener("click", () => {
//               suggestionsBox.style.display = "none";
//               performSearch(li.textContent);
//             });
//           });
//         } else {
//           suggestionsBox.innerHTML = "";
//           suggestionsBox.style.display = "none";
//         }
//       })
//       .catch(() => {
//         suggestionsBox.innerHTML = "";
//         suggestionsBox.style.display = "none";
//       });
//   }, 500);
// });

// // document.addEventListener("click", (e) => {
// //   if (!searchContainer.contains(e.target)) {
// //     suggestionsBox.style.display = "none";
// //   }
// // });
