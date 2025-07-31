class CluesController < ApplicationController
  before_action :set_clue, only: %i[ show edit update destroy ]
  skip_before_action :verify_authenticity_token, only: [ :search ]

  # GET /clues or /clues.json
  def index
    @clues = Clue.all
  end

  # POST /clues/search - Search for clues matching a pattern
  def search
    length = params[:length].to_i
    pattern = params[:pattern].upcase

    # Convert pattern to SQL LIKE pattern (replace _ with %)
    sql_pattern = pattern.gsub("_", "%")

    clues = Clue.select(:id, :clue_text, :answer)
                .where("LENGTH(answer) = ? AND UPPER(answer) LIKE ?", length, sql_pattern)
                .limit(20)

    render json: clues
  end  # GET /clues/1 or /clues/1.json
  def show
  end

  # GET /clues/new
  def new
    @clue = Clue.new
  end

  # GET /clues/1/edit
  def edit
  end

  # POST /clues or /clues.json
  def create
    @clue = Clue.new(clue_params)

    respond_to do |format|
      if @clue.save
        format.html { redirect_to @clue, notice: "Clue was successfully created." }
        format.json { render :show, status: :created, location: @clue }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @clue.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /clues/1 or /clues/1.json
  def update
    respond_to do |format|
      if @clue.update(clue_params)
        format.html { redirect_to @clue, notice: "Clue was successfully updated." }
        format.json { render :show, status: :ok, location: @clue }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @clue.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /clues/1 or /clues/1.json
  def destroy
    @clue.destroy!

    respond_to do |format|
      format.html { redirect_to clues_path, status: :see_other, notice: "Clue was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_clue
      @clue = Clue.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def clue_params
      params.expect(clue: [ :clue_text, :answer, :difficulty, :category ])
    end
end
