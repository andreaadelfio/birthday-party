document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const missionBoard = document.getElementById("mission-board");
  const leaderboardContainer = document.getElementById("leaderboard-container");
  const claimMissionList = document.getElementById("claim-mission-list");
  const claimForm = document.getElementById("claim-form");
  const claimFeedback = document.getElementById("claim-feedback");
  const galleryContainer = document.getElementById("gallery-container");
  const loadGalleryBtn = document.getElementById("load-gallery-btn");

  // --- Cloudinary Config ---
  const CLOUDINARY_CLOUD_NAME = 'dvytw7jg4';
  const CLOUDINARY_UPLOAD_PRESET = 'fantamatte_preset'; // IMPORTANT: Create this unsigned preset in your Cloudinary account
  const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const CLOUDINARY_FOLDER = 'birthday'; // Upload to the 'birthday' folder
  const CLOUDINARY_GALLERY_TAG = 'fantamatte-proof'; // The tag to list gallery images

  // --- Mission Data ---
  let missions = [];
  let galleryPage = 0;
  let galleryPhotos = [];
  const GALLERY_PAGE_SIZE = 5;

  // --- Supabase Client ---
  const supabase = window.SUPABASE_CONFIG ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey) : null;

  // --- Rendering Functions ---
  const renderMissionBoard = (missionsData) => {
    if (!missionBoard) return;
    const sortedMissions = missionsData.sort((a, b) => b.points - a.points);
    missionBoard.innerHTML = `
      <table class="mission-table">
        <thead>
          <tr>
            <th>Mission</th>
            <th>Description</th>
            <th>Points</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          ${sortedMissions.map(mission => `
            <tr>
              <td>${mission.title}</td>
              <td>${mission.description}</td>
              <td class="mission-points-cell">${mission.points}</td>
              <td class="mission-id-cell">${mission.id}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  };

  const renderLeaderboard = async () => {
    if (!leaderboardContainer) return;

    if (!supabase) {
        leaderboardContainer.innerHTML = "<p>Leaderboard is unavailable.</p>";
        return;
    }

    const { data: players, error } = await supabase.rpc('get_leaderboard');

    if (error) {
        console.error("Error fetching leaderboard:", error);
        leaderboardContainer.innerHTML = "<p>Could not load leaderboard.</p>";
        return;
    }

    if (players.length === 0) {
      leaderboardContainer.innerHTML = "<p>No players yet. Be the first to complete a mission!</p>";
      return;
    }

    leaderboardContainer.innerHTML = `
      <ol class="leaderboard-list">
        ${players.map((player, index) => `
          <li>
            <span class="player-rank">${index + 1}</span>
            <span class="player-name">${player.username || 'Anonymous'}</span>
            <span class="player-score">${player.score} pts</span>
          </li>
        `).join("")}
      </ol>
    `;
  };

  const handleMissionIdInput = (event) => {
    const missionId = parseInt(event.target.value, 10);
    const mission = missions.find(m => m.id === missionId);
    const missionTitleElement = document.getElementById('mission-title-preview');
    if (missionTitleElement) {
        missionTitleElement.textContent = mission ? `Mission: ${mission.title}` : 'Mission not found';
    }
  };

  // --- Event Handlers ---
  const handleClaimFormSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(claimForm);
    const username = formData.get("username")?.trim().toLowerCase()
    const missionId = parseInt(formData.get("mission_id"), 10);
    const notes = formData.get("notes")?.trim();
    const proofFile = formData.get("proof");

    if (!username) {
      setFeedback(claimFeedback, "Please enter your username.", "error");
      return;
    }

    if (!missionId || isNaN(missionId)) {
      setFeedback(claimFeedback, "Please enter a valid Mission ID.", "error");
      return;
    }

    if (!supabase) {
        setFeedback(claimFeedback, "Cannot connect to the game server.", "error");
        return;
    }

    // const mission = missions.find(m => m.id === missionId);
    // if (!mission) {
    //     setFeedback(claimFeedback, `Mission with ID ${missionId} not found.`, "error");
    //     return;
    // }


    // Handle file upload to Cloudinary first
    let proofUrl = null;
    if (proofFile && proofFile.size > 0) {
        setFeedback(claimFeedback, "Preparing and uploading proof...", "muted");

        const isImage = proofFile.type.startsWith('image/');
        // Compress image if it's an image, otherwise upload original file (for videos)
        const fileToUpload = isImage ? await compressImage(proofFile) : proofFile;

        const uploadResult = await uploadToCloudinary(fileToUpload, notes);
        if (uploadResult && uploadResult.secure_url) {
            proofUrl = uploadResult.secure_url;
        } else {
            setFeedback(claimFeedback, "Proof upload failed. Please try again.", "error");
            // Ensure the form is usable again after a failed upload
            claimForm.querySelector('button[type="submit"]').disabled = false;
            return;
        }
    }

    const { data: userProofs } = await supabase.from('mission_proofs').select('mission_id').eq('player_username', username);
    const userCompletedMissionIds = userProofs ? userProofs.map(p => p.mission_id) : [];

    const hasCompletedBefore = userCompletedMissionIds.includes(missionId);
    let pointsGained = mission.points;

    if (hasCompletedBefore) {
      if (mission.repeat_bonus_enabled) {
        pointsGained = Math.round(pointsGained * 0.5); // Repeat bonus
      } else {
        // Cannot repeat this mission
        setFeedback(claimFeedback, `You have already completed the mission "${mission.title}" and it cannot be repeated.`, "warning");
        return;
      }
    }

    const proofToInsert = {
      player_username: username,
      mission_id: missionId,
      points_awarded: pointsGained,
      proof_url: proofUrl,
      notes: notes || null,
    };

    const { error } = await supabase.from('mission_proofs').insert([proofToInsert]);
    if (error) {
        setFeedback(claimFeedback, `Error saving progress: ${error.message}`, "error");
        return;
    }
    
    // Re-render components
    await renderLeaderboard();

    setFeedback(claimFeedback, `Success! You gained ${pointsGained} points.`, "success");
    claimForm.reset();
  };

  // --- Image Compression Function ---
  const compressImage = async (file) => {
    // Don't compress if it's already small
    if (file.size / 1024 / 1024 < 8) {
        return file;
    }

    const options = {
      maxSizeMB: 8, // Set max size to 8MB, safely under the 10MB limit
      maxWidthOrHeight: 1920, // Resize to a reasonable web dimension
      useWebWorker: true,
      onProgress: (p) => { setFeedback(claimFeedback, `Compressing image: ${p.toFixed(0)}%`, "muted"); },
    };

    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Image compression error:', error);
      return file; // If compression fails, return the original file
    }
  };
  // --- Cloudinary Upload Function ---
  const uploadToCloudinary = async (file, caption) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', CLOUDINARY_FOLDER);
    formData.append('tags', [CLOUDINARY_GALLERY_TAG]);
    if (caption) {
      formData.append('context', `caption=${caption}`);
    }

    try {
        const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Cloudinary upload failed');
        return await response.json();
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        setFeedback(claimFeedback, `Upload error: ${error.message}`, "error");
        return null;
    }
  };

  const withCloudinaryTransform = (url, transform) => {
    if (!url) return '';
    const marker = '/image/upload/';
    if (!url.includes(marker)) return url;
    return url.replace(marker, `${marker}${transform}/`);
  };

  const handleLoadGallery = async () => {
    loadGalleryBtn.disabled = true;
    loadGalleryBtn.textContent = "Loading...";

    // Fetch all images from Cloudinary only on the first load
    if (galleryPage === 0) {
        try {
            const listUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/${CLOUDINARY_GALLERY_TAG}.json?timestamp=${new Date().getTime()}`;
            const response = await fetch(listUrl);
            if (!response.ok) throw new Error(`Cloudinary list failed with status ${response.status}`);
            const data = await response.json();
            
            const resources = Array.isArray(data?.resources) ? data.resources : [];
            // Sort by creation date descending
            resources.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            galleryPhotos = resources.map(resource => {
                const context = resource.context?.custom || {};
                return {
                    full: withCloudinaryTransform(resource.secure_url, 'f_auto,q_auto,w_1920'),
                    thumb: withCloudinaryTransform(resource.secure_url, 'f_auto,q_auto,w_600'),
                    alt: context.alt || context.caption || `Proof image`,
                    title: `Mission Proof`,
                    description: context.caption || context.alt || ''
                };
            });

            galleryContainer.innerHTML = ''; // Clear placeholder
        } catch (error) {
            galleryContainer.innerHTML = `<p class="error">Could not load images from Cloudinary.</p>`;
            console.error("Gallery error:", error);
            loadGalleryBtn.textContent = "Error";
            return;
        }
    }

    // Now, render the next batch of photos from the cached list
    const start = galleryPage * GALLERY_PAGE_SIZE;
    const end = start + GALLERY_PAGE_SIZE;
    const batch = galleryPhotos.slice(start, end);

    if (batch.length > 0) {
        const fragment = document.createDocumentFragment();
        batch.forEach((photoData, index) => {
            const card = createPhotoCard(photoData, start + index);
            if (card) fragment.appendChild(card);
        });
        galleryContainer.appendChild(fragment);

        galleryPage++;
        loadGalleryBtn.disabled = false;
        loadGalleryBtn.textContent = "Load More";
    }

    if (end >= galleryPhotos.length) {
        loadGalleryBtn.textContent = "No More Images";
        loadGalleryBtn.disabled = true;
    }
  };

  const createPhotoCard = (photoData, index) => {
      const card = document.createElement('div');
      card.className = 'gallery-item';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'gallery-item-trigger';
      trigger.setAttribute('aria-label', `Open preview for: ${photoData.alt}`);

      const imgElement = document.createElement('img');
      imgElement.src = photoData.thumb;
      imgElement.alt = photoData.alt;
      imgElement.loading = 'lazy';
      trigger.appendChild(imgElement);

      if (photoData.description) {
          const caption = document.createElement('p');
          caption.className = 'gallery-caption';
          caption.textContent = photoData.description;
          card.appendChild(caption);
      }

      trigger.addEventListener('click', () => {
          previewController.open({
              trigger,
              allPhotos: galleryPhotos,
              index
          });
      });

      card.insertBefore(trigger, card.firstChild);
      return card;
  };

  const createPhotoPreviewController = () => {
      const modal = document.createElement('div');
      modal.className = 'photo-preview-modal';
      modal.hidden = true;

      const panel = document.createElement('div');
      panel.className = 'photo-preview-panel';

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'photo-preview-close';
      closeButton.textContent = '×';

      const prevButton = document.createElement('button');
      prevButton.type = 'button';
      prevButton.className = 'photo-preview-nav photo-preview-nav-prev';
      prevButton.innerHTML = '&#8249;';

      const nextButton = document.createElement('button');
      nextButton.type = 'button';
      nextButton.className = 'photo-preview-nav photo-preview-nav-next';
      nextButton.innerHTML = '&#8250;';

      const spinner = document.createElement('div');
      spinner.className = 'photo-preview-spinner';

      const image = document.createElement('img');
      image.className = 'photo-preview-image';

      const caption = document.createElement('div');
      caption.className = 'photo-preview-caption';

      panel.append(spinner, image, caption, prevButton, nextButton, closeButton);
      modal.appendChild(panel);
      document.body.appendChild(modal);

      let photos = [];
      let currentIndex = -1;
      let lastFocusedElement = null;

      const displayPhoto = (index) => {
          if (index < 0 || index >= photos.length) return;
          currentIndex = index;
          const photo = photos[index];

          spinner.hidden = false;
          image.style.opacity = '0';
          image.src = photo.full;
          image.alt = photo.alt;
          caption.textContent = photo.description;
          caption.hidden = !photo.description;

          prevButton.hidden = currentIndex === 0;
          nextButton.hidden = currentIndex === photos.length - 1;
      };

      const open = (payload) => {
          lastFocusedElement = payload.trigger || document.activeElement;
          photos = payload.allPhotos || [];
          modal.hidden = false;
          document.body.classList.add('photo-preview-open');
          displayPhoto(payload.index);
          closeButton.focus();
      };

      const close = () => {
          modal.hidden = true;
          document.body.classList.remove('photo-preview-open');
          if (lastFocusedElement) lastFocusedElement.focus();
      };

      const navigate = (direction) => {
          const newIndex = currentIndex + direction;
          if (newIndex >= 0 && newIndex < photos.length) {
              displayPhoto(newIndex);
          }
      };

      image.onload = () => {
          spinner.hidden = true;
          image.style.opacity = '1';
      };

      modal.addEventListener('click', (e) => {
          if (e.target === modal) close();
      });
      closeButton.addEventListener('click', close);
      prevButton.addEventListener('click', () => navigate(-1));
      nextButton.addEventListener('click', () => navigate(1));

      document.addEventListener('keydown', (e) => {
          if (modal.hidden) return;
          if (e.key === 'Escape') close();
          if (e.key === 'ArrowLeft') navigate(-1);
          if (e.key === 'ArrowRight') navigate(1);
      });

      return { open };
  };

  const previewController = createPhotoPreviewController();

  // --- Utility Functions ---
  const setFeedback = (element, message, tone) => {
    if (!element) return;
    element.textContent = message;
    element.dataset.tone = tone;
    setTimeout(() => {
        element.textContent = "";
        element.dataset.tone = "muted";
    }, 5000);
  };

  // --- Initialization ---
  const initFantaMatte = async () => {
    if (document.querySelector('[data-nav-current="fantamatte"]')) {
        if (!supabase) {
            missionBoard.innerHTML = "<p>Could not connect to the game server.</p>";
            leaderboardContainer.innerHTML = "<p>Could not connect to the game server.</p>";
            return;
        }

        await renderLeaderboard();

        const { data, error } = await supabase.from('missions').select('*');

        if (error) {
            console.error("Error fetching missions:", error);
            missionBoard.innerHTML = "<p>Could not load missions.</p>";
            return;
        }

        missions = data;
        renderMissionBoard(missions);

        if (claimForm) {
            claimForm.addEventListener("submit", handleClaimFormSubmit);
            const missionIdInput = claimForm.querySelector('input[name="mission_id"]');
            if (missionIdInput) {
                missionIdInput.addEventListener('input', handleMissionIdInput);
            }
        }

        if (loadGalleryBtn) {
            loadGalleryBtn.addEventListener("click", handleLoadGallery);
        }
    }
  };

  initFantaMatte().catch(console.error);
});