const periodicRefreshPeriod = 10;
let categories = [];
let selectedCategory = "";
let search = "";
let currentETag = "";
let hold_Periodic_Refresh = false;
let pageManager;
let itemLayout;

let waiting = null;
let waitingGifTrigger = 2000;
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        $("#itemsPanel").append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

Init_UI();

async function Init_UI() {
    itemLayout = {
        width: $("#sample").outerWidth(),
        height: $("#sample").outerHeight()
    };
    pageManager = new PageManager('scrollPanel', 'itemsPanel', itemLayout, renderPosts);
    compileCategories();
    $('#createPost').on("click", async function () {
        renderCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts()
    });
    $('#searchCmd').on("click", function () {
        renderSearch();
    });
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $("#searchKey").on("change", () => {
        doSearch();
    })
    $('#doSearch').on('click', () => {
        doSearch();
    })
    showPosts();
    start_Periodic_Refresh();
}
function doSearch() {
    search = $("#searchKey").val().replace(' ', ',');
    pageManager.reset();
}
function showPosts() {
    $("#actionTitle").text("Liste des favoris");
    $("#scrollPanel").show();
    $('#abort').hide();
    $('#PostForm').hide();
    $('#aboutContainer').hide();
    $("#search").hide();
    $("#createPost").show();
    if(search != ""){
        $("#search").show();
    }
    hold_Periodic_Refresh = false;
}
function hidePosts() {
    $("#scrollPanel").hide();
    $("#createPost").hide();
    $("#search").hide();
    $("#abort").show();
    search = "";
    hold_Periodic_Refresh = true;
}
function start_Periodic_Refresh() {
    setInterval(async () => {
        if (!hold_Periodic_Refresh) {
            let etag = await Posts_API.HEAD();
            if (currentETag != etag) {
                currentETag = etag;
                await pageManager.update(false);
                compileCategories();
            }
        }
    },
        periodicRefreshPeriod * 1000);
}
function renderAbout() {
    hidePosts();
    $("#actionTitle").text("À propos...");
    $("#aboutContainer").show();
}
function renderSearch() {
    showPosts();
    $("#search").show();
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="searchCmd">
                <i class="menuIcon fa fa-search mx-2"></i> Rechercher par mot
            </div>
            `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $('#searchCmd').on("click", function () {
        renderSearch();
    });
    $('#allCatCmd').on("click", function () {
        showPosts();
        selectedCategory = "";
        updateDropDownMenu();
        pageManager.reset();
    });
    $('.category').on("click", function () {
        showPosts();
        selectedCategory = $(this).text().trim();
        updateDropDownMenu();
        pageManager.reset();
    });
}
async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            updateDropDownMenu(categories);
        }
    }
}
async function renderPosts(queryString) {
    let endOfData = false;
    queryString += "&sort=category";
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    addWaitingGif();
    let response = await Posts_API.Get(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        let Posts = [];
        if(search != ""){
            response.data.forEach((post) => {
                if(post.Text.includes(search) || post.Title.includes(search)){
                    Posts.push(post);
                }
            });
        }
        else{
            Posts = response.data;
        }
        if (Posts.length > 0) {
            Posts.sort((a, b) => b.Creation - a.Creation);
            Posts.forEach(Post => {
                $("#itemsPanel").append(renderPost(Post));
            });
            $(".editCmd").off();
            $(".editCmd").on("click", function () {
                renderEditPostForm($(this).attr("editPostId"));
            });
            $(".deleteCmd").off();
            $(".deleteCmd").on("click", function () {
                renderDeletePostForm($(this).attr("deletePostId"));
            });
        } else
            endOfData = true;
    } else {
        renderError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}

function renderError(message) {
    hidePosts();
    $("#actionTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").append($(`<div>${message}</div>`));
}
function renderCreatePostForm() {
    renderPostForm();
}
async function renderEditPostForm(id) {
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            renderError("Post introuvable!");
    } else {
        renderError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    hidePosts();
    $("#actionTitle").text("Retrait");
    $('#PostForm').show();
    $('#PostForm').empty();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null) {
            $("#PostForm").append(`
        <div class="PostdeleteForm">
            <h4>Effacer la nouvelle suivante?</h4>
            <br>
            <div class="PostRow" id=${Post.Id}">
                <div class="PostContainer noselect">
                    <div class="PostLayout">
                        <span class="PostCategory">${Post.Category}</span>
                        <div class="Post">
                            <span class="PostTitle">${Post.Title}</span>
                            <img src="${Post.Image}" alt="${Post.Title}" class="PostImg">
                            <span class="PostText"><span id="text_${Post.Id}" class="smallText">${Post.Text}</span> <a id="bouton_${Post.Id}" class="buttonAffichage" onclick="renderText('${Post.Id}')">Afficher plus</a></span>
                        </div>
                    </div>
                    <div class="PostCommandPanel">
                        <span class="editCmd cmdIcon fa fa-pencil" editPostId="${Post.Id}" title="Modifier ${Post.Title}"></span>
                        <span class="deleteCmd cmdIcon fa fa-trash" deletePostId="${Post.Id}" title="Effacer ${Post.Title}"></span>
                    </div>
                </div>
            </div>   
            <br>
            <input type="button" value="Effacer" id="deletePost" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </div>    
        `);
            $('#deletePost').on("click", async function () {
                await Posts_API.Delete(Post.Id);
                if (!Posts_API.error) {
                    showPosts();
                    await pageManager.update(false);
                    compileCategories();
                }
                else {
                    console.log(Posts_API.currentHttpError)
                    renderError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", function () {
                showPosts();
            });

        } else {
            renderError("Post introuvable!");
        }
    } else
        renderError(Posts_API.currentHttpError);
}
function getFormData($form) {
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}
function newPost() {
    Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Category = "";
    Post.Image = "images/no-news.png";
    Post.Creation = Date.now();
    return Post;
}
function renderPostForm(Post = null) {
    hidePosts();
    let create = Post == null;
    if (create) {
        Post = newPost();
    }
    $("#actionTitle").text(create ? "Création" : "Modification");
    $("#PostForm").show();
    $("#PostForm").empty();
    $("#PostForm").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${Post.Id}"/>

            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${Post.Title}"
            />
            <label for="Text" class="form-label">Text </label>
            <TextArea
                class="form-control Text"
                name="Text"
                id="Text"
                placeholder="Text"
                rows="10"
                required
            >${Post.Text}</TextArea>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${Post.Category}"
            />
            <label class="form-label">Image </label>
            <div   class='imageUploader' 
                   newImage='${create}' 
                   controlId='Image' 
                   imageSrc='${Post.Image}' 
                   waitingImage="Loading_icon.gif">
            </div>
            <input type="hidden" name="Creation" value="${Post.Creation}"/>
            <hr>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </form>
    `);
    initImageUploaders();
    initFormValidation();
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let Post = getFormData($("#postForm"));
        Post = await Posts_API.Save(Post, create);
        if (!Posts_API.error) {
            showPosts();
            await pageManager.update(false);
            compileCategories();
            pageManager.scrollToElem(Post.Id);
        }
        else
            renderError("Une erreur est survenue!");
    });
    $('#cancel').on("click", function () {
        showPosts();
    });
}
function renderPost(Post) {
    let date = new Date(Post.Creation);
    let dateString = "";
    let jourSemaine = date.getDay()
    const JourDeLaSemaine = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const Mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    for (let i = 0; i < JourDeLaSemaine.length; i++) {
        if (jourSemaine == i) {
            dateString += JourDeLaSemaine[i] + " le ";
        }
    }
    dateString += date.getDate() + " ";
    let month = date.getMonth()
    for (let i = 0; i < Mois.length; i++) {
        if (month == i) {
            dateString += Mois[i] + " ";
        }
    }
    dateString += date.getFullYear() + " - ";
    dateString += date.getHours() + ":"
    dateString += (date.getMinutes() < 10 ? '0' : '') + date.getMinutes() + ":"
    dateString += (date.getSeconds() < 10 ? '0' : '') + date.getSeconds() + ""

    const maxTextLength = 325
    let afficherPlus = ""
    if(Post.Text.length > maxTextLength){
        afficherPlus = `<a id="bouton_${Post.Id}" class="buttonAffichage" onclick="renderText('${Post.Id}')">Afficher plus</a>`;
    }
    return $(`
     <div class="PostRow" id='${Post.Id}'>
        <div class="PostContainer noselect">
            <div class="PostLayout">
                <span class="PostCategory">${Post.Category}</span>
                <div class="PostCommandPanel">
                    <span class="editCmd cmdIcon fa fa-square-pen" editPostId="${Post.Id}" title="Modifier ${Post.Title}"></span>
                    <span class="deleteCmd cmdIcon fa fa-rectangle-xmark" deletePostId="${Post.Id}" title="Effacer ${Post.Title}"></span>
                </div>
                <div class="Post">
                    <span class="PostTitle">${Post.Title}</span>
                    <img src="${Post.Image}" alt="${Post.Title}" class="PostImg">
                    <span class="PostCreation">${dateString}</span>
                    <span class="PostText"><span id="text_${Post.Id}" class="smallText">${Post.Text}</span> ${afficherPlus}</span>
                </div>
            </div>
        </div>
    </div>           
    `);
}
function convertToFrenchDate(numeric_date) {
    date = new Date(numeric_date);
    var options = { year: 'numeric', month: 'long', day: 'numeric' };
    var opt_weekday = { weekday: 'long' };
    var weekday = toTitleCase(date.toLocaleDateString("fr-FR", opt_weekday));

    function toTitleCase(str) {
        return str.replace(
            /\w\S*/g,
            function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            }
        );
    }
    return weekday + " le " + date.toLocaleDateString("fr-FR", options) + " @ " + date.toLocaleTimeString("fr-FR");
}
function renderText(id) {
    console.log("Click");
    var text = document.getElementById(`text_${id}`);
    var button = document.getElementById(`bouton_${id}`);
    //console.log(button.textContent);
    if (button.textContent == "Afficher plus") {
        //console.log(text)
        text.classList.remove("smallText");
        button.textContent = "Afficher moins";
    }
    else {
        //console.log(text)
        text.classList.add("smallText");
        button.textContent = "Afficher plus";
    }
}