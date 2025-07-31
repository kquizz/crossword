Rails.application.routes.draw do
  # Root route
  root "puzzles#index"

  # Crossword game routes
  get "crossword_game/play/:id", to: "crossword_game#play", as: :play_crossword
  get "crossword_game/play", to: "crossword_game#play"
  get "crossword_game/create", to: "crossword_game#create"
  post "crossword_game/save_puzzle", to: "crossword_game#save_puzzle"
  post "crossword_game/save_puzzle_clue", to: "crossword_game#save_puzzle_clue"
  patch "crossword_game/update_cell", to: "crossword_game#update_cell"

  resources :puzzles do
    member do
      get :export_puz
    end
    collection do
      get :import_form
      post :import_puz
    end
  end
  resources :clues do
    collection do
      post :search
    end
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  # root "posts#index"
end
