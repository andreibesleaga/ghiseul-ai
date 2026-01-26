# IMPORTING DEPENDENCIES
import os
import time
import json
import pandas as pd
from getpass import getpass
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain.chat_models import ChatOllama
from langchain.chat_models import ChatOpenAI
from langchain_huggingface import HuggingFaceEndpoint  # Hugging Face support

# Load API keys from environment variables if needed
HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
OPENAI_API_KEY = getpass("Your OpenAI_API_key: ")

# CONFIGURATION
evaluation_data_path = "your/evaluation/data_path"  # Update file path
candidate_llms = ["llm_1_name", "llm_2_name", "llm_3_name"]
candidate_llm_provider = "ollama"  # Change to "huggingface" or "openai" as needed
evaluation_llm_name = "evaluation_llm_name"
evaluation_llm_provider = "ollama"  # Change to "huggingface" or "openai" as needed

# PROMPTS
llm_test_prompt = PromptTemplate(
    template="""You are a helpful and friendly assistant 
    who answers questions about public services in Romania.
    Please answer this user question based on provided context:  
    USER QUESTION: \n {question} \n
    CONTEXT: {context} \n
    Please provide your response as a JSON with a single key 'Response'.""",
    input_variables=["question", "context"],
)

llm_evaluation_prompt = PromptTemplate(
    template="""Please score the quality and accuracy of a given answer, 
    by comparing it to the golden standard reference answer. 
    Give the answer a score from 0 (low-quality/inaccurate) to 10 (high-quality/accurate)
    based on your assessment.   
    GIVEN ANSWER: \n {given_answer} \n
    REFERENCE ANSWER: {reference_answer} \n
    Please provide your response as a JSON with a single key 'Score',
    containing the integer that corresponds to your score.""",
    input_variables=["given_answer", "reference_answer"],
)


def get_candidate_llm(model_name):
    """Returns the appropriate LLM instance based on the selected provider."""
    if candidate_llm_provider == "ollama":
        return ChatOllama(model=model_name, format="json", temperature=0)
    
    elif candidate_llm_provider == "huggingface":
        if not HF_API_KEY:
            raise ValueError("Missing Hugging Face API key. Set HUGGINGFACE_API_KEY as an environment variable.")
        return HuggingFaceEndpoint(repo_id=model_name, model_kwargs={"temperature": 0}, huggingfacehub_api_token=HF_API_KEY)

    elif candidate_llm_provider == "openai":
        if not OPENAI_API_KEY:
            raise ValueError("Missing OpenAI API key. Set OPENAI_API_KEY as an environment variable.")
        return ChatOpenAI(model=model_name, temperature=0, openai_api_key=OPENAI_API_KEY)
    
    else:
        raise ValueError("Unsupported LLM provider. Use 'ollama', 'huggingface', or 'openai'.")


def get_evaluation_llm(model_name):
    """Returns the appropriate LLM instance based on the selected provider."""
    if evaluation_llm_provider == "ollama":
        return ChatOllama(model=model_name, format="json", temperature=0)
    
    elif evaluation_llm_provider == "huggingface":
        if not HF_API_KEY:
            raise ValueError("Missing Hugging Face API key. Set HUGGINGFACE_API_KEY as an environment variable.")
        return HuggingFaceEndpoint(repo_id=model_name, model_kwargs={"temperature": 0}, huggingfacehub_api_token=HF_API_KEY)

    elif evaluation_llm_provider == "openai":
        if not OPENAI_API_KEY:
            raise ValueError("Missing OpenAI API key. Set OPENAI_API_KEY as an environment variable.")
        return ChatOpenAI(model=model_name, temperature=0, openai_api_key=OPENAI_API_KEY)
    
    else:
        raise ValueError("Unsupported LLM provider. Use 'ollama', 'huggingface', or 'openai'.")


def load_data(file_path):
    """Load data from Excel, CSV, or JSON."""
    if file_path.endswith(".xlsx"):
        return pd.read_excel(file_path, engine="openpyxl")
    elif file_path.endswith(".csv"):
        return pd.read_csv(file_path)
    elif file_path.endswith(".json"):
        with open(file_path, "r", encoding="utf-8") as f:
            return pd.DataFrame(json.load(f))
    else:
        raise ValueError("Unsupported file format. Use .xlsx, .csv, or .json")


def save_results(df, file_path):
    """Save results in the same format as the input file."""
    if file_path.endswith(".xlsx"):
        with pd.ExcelWriter(file_path, engine="openpyxl", mode="w") as writer:
            df.to_excel(writer, index=False)
    elif file_path.endswith(".csv"):
        df.to_csv(file_path, index=False)
    elif file_path.endswith(".json"):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(df.to_dict(orient="records"), f, indent=4)
    print(f"Results saved to {file_path}")


def test_llms(candidate_llms, evaluation_data):
    """Test multiple LLMs and generate responses."""
    df = load_data(evaluation_data)

    if "question_test" not in df.columns or "context_test" not in df.columns:
        raise ValueError("The required columns 'question_test' and 'context_test' were not found.")

    for llm_name in candidate_llms:
        print(f"Testing {llm_name} with {candidate_llm_provider}...")
        llm = get_candidate_llm(llm_name)
        test_llm_chain = llm_test_prompt | llm | JsonOutputParser()

        df[llm_name] = ""

        for index, row in df.iterrows():
            question, context = row["question_test"], row["context_test"]

            if pd.notna(question) and pd.notna(context):
                response = test_llm_chain.invoke({"question": question, "context": context})
                df.at[index, llm_name] = response.get("Response", "")

            if (index + 1) % 10 == 0:  # Pause every 10 requests (only relevant if running locally)
                print("Taking a short pause to prevent overload...")
                time.sleep(30)

        print(f"{llm_name} completed.")

    save_results(df, evaluation_data)


def evaluate_answers(candidate_llms, evaluation_data):
    """Evaluate LLM-generated answers against the reference answer."""
    df = load_data(evaluation_data)

    if "answer_test" not in df.columns:
        raise ValueError("Missing column: 'answer_test' (reference answer).")

    evaluation_llm = get_evaluation_llm(evaluation_llm_name)
    evaluation_llm_chain = llm_evaluation_prompt | evaluation_llm | JsonOutputParser()

    for llm_name in candidate_llms:
        if llm_name not in df.columns:
            raise ValueError(f"Missing LLM response column: {llm_name}")

        results_column = f"{llm_name}_score"
        df[results_column] = ""

        for index, row in df.iterrows():
            reference_answer, given_answer = row["answer_test"], row[llm_name]

            if pd.notna(reference_answer) and pd.notna(given_answer):
                response = evaluation_llm_chain.invoke({"given_answer": given_answer, "reference_answer": reference_answer})
                df.at[index, results_column] = response.get("Score", "")

        print(f"{evaluation_llm_name} evaluated {llm_name} responses.")

    save_results(df, evaluation_data)


def main():
    """Main function to execute LLM testing and evaluation."""
    try:
        print(f"Starting LLM testing using {candidate_llm_provider}...")
        test_llms(candidate_llms, evaluation_data_path)

        print("Starting answer evaluation...")
        evaluate_answers(candidate_llms, evaluation_data_path)

        print("Process complete")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()