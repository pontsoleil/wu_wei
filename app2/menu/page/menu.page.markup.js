/**
 * menu.page.template.js
 * menu page template
 *
 * WuWei is a free, open-source knowledge modelling tool.
 *
 * Licensed under the MIT License.
 * Copyright (c) 2013-2020,2023,2026 SAMBUICHI, Nobuyuki
 * (Sambuichi Professional Engineers Office)
 */
wuwei.menu.page.markup = (function () {
  const
    util = wuwei.util;

  const template = `
<div class="w3-modal-content w3-animate-zoom w3-card-4" style="width:50%">
  <header class="w3-container">
    <i onclick="wuwei.menu.page.close_pane(); return false;"
        class="fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom"></i>
    <h2 class="w3-wide w3-margin-bottom">${translate('Sign in')}</h2>
  </header>
</div>
`;


  function name_form(param) {
    var
      pp = param.pp,
      name = param.name,
      description = param.description;
    var html = `
      <div class="page-name w3-modal-content w3-animate-zoom w3-card-4">
        <header class="w3-container"> 
          <i onclick="wuwei.menu.page.close_pane(); return false;"
              class="fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom"></i>
          <h2>${translate('Pages')} ${translate('Name')}</h2>${pp}
        </header>
        <form class="w3-container w3-white w3-center">
          <div class="name w3-row">
            <label for="name" class="w3-col s4">${translate('Name')}</label>
            <input type="text" id="name" name="name" class="w3-col s8" value="${name}">
          </div>
          <div class="description w3-row">
            <textarea id="description" name="description"
                class="w3-col s12 w3-input w3-border" style="resize:none" value="${description}"></textarea>
          </div>
          <div class="w3-row w3-display-bottommiddle">
            <button type="button" onclick="wuwei.menu.page.namePage('${pp}', event); return false;"
                class="w3-button w3-padding-large w3-indigo w3-margin-top w3-margin-bottom">
              ${translate('Save')}
            </button>
            <input type="button" onclick="wuwei.menu.page.close_pane();  return false;"
                class="w3-button w3-padding-large w3-gray w3-margin-top w3-margin-bottom"
                value="${translate('Close')}">
          </div>
        </form>
      </div>`;
    return html;
  }


  //   function list_template(pages) {
  //     function pageGallery(pages) {
  //       const gallery = pages.map((page, index) => {
  //         const slotPP = index + 1;

  //         if (!page) {
  //           return `
  //         <div class="page blank">
  //           <div id="page_${slotPP}" class="flip-card blank">
  //             <div class="flip-card-inner">
  //               <div class="flip-card-front">
  //                 <p class="pp">${slotPP}</p>
  //                 <p class="name"></p>
  //                 <div class="thumbnail blank"></div>
  //               </div>
  //               <div class="flip-card-back">
  //                 <div class="desc">
  //                   <p class="pp">${slotPP}</p>
  //                   <p class="name"></p>
  //                   <p class="description"></p>
  //                 </div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>`;
  //         }

  //         const
  //           pp = page.pp,
  //           name = page.name || '',
  //           description = page.description || '',
  //           common = wuwei.common,
  //           util = wuwei.util,
  //           thumbnail = util.buildMiniatureSvgString({
  //             width: 200,
  //             height: 200,
  //             nodes: page.nodes,
  //             links: page.links
  //           });

  //         return `
  //         <div class="page" onclick="wuwei.menu.page.openPage('${pp}', event); return false;">
  //           <div id="page_${pp}" class="flip-card"
  //               draggable="true">
  //             <div class="flip-card-inner">
  //               <div class="flip-card-front">
  //                 <p class="pp">${pp}</p>
  //                 <p class="name">${name}</p>
  //                 <div class="thumbnail">${thumbnail}</div>
  //               </div>
  //               <div class="flip-card-back">
  //                 <div class="desc">
  //                   <p class="pp">${pp}</p>
  //                   <p class="name">${name}</p>
  //                   <p class="description">${description}</p>
  //                 </div>
  //                 <i onclick="wuwei.menu.page.editPage('${pp}', event); return false;"
  //                   class="edit fas fa-signature w3-button w3-transparent w3-large"></i>
  //                 <i onclick="wuwei.menu.page.removePage('${pp}', event); return false;"
  //                   class="remove fas fa-trash w3-button w3-transparent w3-large"></i>
  //               </div>
  //             </div>
  //           </div>
  //         </div>`;
  //       }).join('');
  //       return gallery;
  //     }

  //     return `
  // <div class="list w3-modal-content w3-animate-zoom w3-card-4">
  //   <header class="w3-container">
  //     <h2 class="w3-wide w3-margin-bottom">${translate('List of Pages')}</h2>
  //     <i onclick="wuwei.menu.page.close_list(); return false;"
  //         class="dismiss fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom">
  //     </i>
  //   </header>
  //   <div id="gallery" class="${wuwei.common.state.iOS ? 'iOS' : ''}">${pageGallery(pages)}</div>
  // </div>`;
  //   }
  function list_template(pages, mode) {
    const listMode = mode || 'list';

    function pageGallery(pages) {
      const gallery = pages.map((page, index) => {
        const slotPP = index + 1;

        // 削除済みスロット: 場所だけ空けて何も描かない
        if (!page) {
          return `
        <div class="page empty-slot" aria-hidden="true">
        </div>`;
        }

        const
          pp = page.pp,
          name = page.name || '',
          description = page.description || '',
          util = wuwei.util;
        let thumbnail = page.thumbnail || '';
        if (!thumbnail) {
          thumbnail = (wuwei.note && typeof wuwei.note.buildPageThumbnail === 'function')
            ? wuwei.note.buildPageThumbnail(page)
            : util.buildMiniatureSvgString({
              width: 200,
              height: 200,
              useDataOnly: true,
              showViewFrame: true,
              backgroundFill: '#ffffff',
              nodes: page.nodes,
              links: page.links
            });
          page.thumbnail = thumbnail;
        }

        return `
        <div class="page" onclick="wuwei.menu.page.openPage('${pp}', event); return false;">
          <div id="page_${pp}" class="flip-card ${listMode}"
              draggable="true" ondragstart="wuwei.menu.page.drag(event)">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <p class="pp">${pp}</p>
                <p class="name">${name}</p>
                <div class="thumbnail">${thumbnail}</div>
              </div>
              <div class="flip-card-back">
                <div class="desc">
                  <p class="pp">${pp}</p>
                  <p class="name">${name}</p>
                  <p class="description">${description}</p>
                </div>
                <i onclick="wuwei.menu.page.editPage('${pp}', event); return false;"
                  class="edit fas fa-signature w3-button w3-transparent w3-large"
                  title="${translate('Name')}"></i>
                <i onclick="wuwei.menu.page.copyPage('${pp}', event); return false;"
                  class="copy far fa-clone w3-button w3-transparent w3-large"
                  title="${translate('Copy')}"></i>
                <i onclick="wuwei.menu.page.removePage('${pp}', event); return false;"
                  class="remove fas fa-trash w3-button w3-transparent w3-large"
                  title="${translate('Delete')}"></i>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
      return gallery;
    }

    return `
<div class="list w3-modal-content w3-animate-zoom w3-card-4">
  <header class="w3-container">
    <h2 class="w3-wide w3-margin-bottom">${translate('List of Pages')}</h2>
    <button type="button"
        onclick="wuwei.menu.page.addPage(event); return false;"
        class="page-add-button w3-button w3-transparent w3-large"
        title="${translate('Add Page')}">
      <i class="fa fa-plus"></i>
      <span>${translate('Add Page')}</span>
    </button>
    <p class="page-list-guidance">${listMode === 'name'
        ? translate('Select a page and edit its name.')
        : listMode === 'copy'
          ? translate('Select a page to copy.')
          : translate('Select a page to open, edit, copy, or delete.')}</p>
    <i onclick="wuwei.menu.page.close_list(); return false;"
        class="dismiss fas fa-times w3-right w3-button w3-transparent w3-large w3-margin-bottom">
    </i>
  </header>
  <div id="gallery" class="${wuwei.common.state.iOS ? 'iOS' : ''}">${pageGallery(pages)}</div>
</div>`;
  }


  function translate(str) {
    return wuwei.nls.translate(str);
  }


  return {
    name_form: name_form,
    template: template,
    list_template: list_template
  };
})();
// menu.page.markup.js revised 2026-03-18
